import bcrypt from 'bcryptjs';
import { getDb } from './index';

export interface OidcProvider {
  id: string;
  name: string;
  issuer: string;
  client_id: string;
  client_secret: string;
  enabled: number;
  created_at: string;
}

export interface UserIdentity {
  id: string;
  user_id: string;
  provider_id: string;
  external_id: string;
  refresh_token: string | null;
  created_at: string;
}

// ── Providers ─────────────────────────────────────────────────────────────────

export async function listOidcProviders(enabledOnly = false): Promise<OidcProvider[]> {
  const db = getDb();
  const where = enabledOnly ? 'WHERE enabled = 1' : '';
  const { rows } = await db.query<OidcProvider>(
    `SELECT * FROM _zenku_oidc_providers ${where} ORDER BY created_at ASC`
  );
  return rows;
}

export async function getOidcProvider(id: string): Promise<OidcProvider | null> {
  const { rows } = await getDb().query<OidcProvider>(
    'SELECT * FROM _zenku_oidc_providers WHERE id = ?',
    [id]
  );
  return rows[0] ?? null;
}

export async function createOidcProvider(
  name: string, issuer: string, clientId: string, clientSecret: string
): Promise<OidcProvider> {
  const id = crypto.randomUUID();
  const db = getDb();
  await db.execute(
    `INSERT INTO _zenku_oidc_providers (id, name, issuer, client_id, client_secret, enabled)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [id, name, issuer, clientId, clientSecret]
  );
  return (await getOidcProvider(id))!;
}

export async function updateOidcProvider(
  id: string,
  patch: Partial<Pick<OidcProvider, 'name' | 'issuer' | 'client_id' | 'client_secret' | 'enabled'>>
): Promise<boolean> {
  const fields = Object.keys(patch) as (keyof typeof patch)[];
  if (fields.length === 0) return false;
  const sets = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => patch[f]);
  const result = await getDb().execute(
    `UPDATE _zenku_oidc_providers SET ${sets} WHERE id = ?`,
    [...values, id]
  );
  return result.rowsAffected > 0;
}

export async function deleteOidcProvider(id: string): Promise<boolean> {
  const result = await getDb().execute(
    'DELETE FROM _zenku_oidc_providers WHERE id = ?',
    [id]
  );
  return result.rowsAffected > 0;
}

// ── User identities ───────────────────────────────────────────────────────────

export async function findIdentity(providerId: string, externalId: string): Promise<UserIdentity | null> {
  const { rows } = await getDb().query<UserIdentity>(
    'SELECT * FROM _zenku_user_identities WHERE provider_id = ? AND external_id = ?',
    [providerId, externalId]
  );
  return rows[0] ?? null;
}

export async function findIdentityByUserId(userId: string, providerId: string): Promise<UserIdentity | null> {
  const { rows } = await getDb().query<UserIdentity>(
    'SELECT * FROM _zenku_user_identities WHERE user_id = ? AND provider_id = ?',
    [userId, providerId]
  );
  return rows[0] ?? null;
}

export async function updateRefreshToken(userId: string, providerId: string, refreshToken: string | null): Promise<void> {
  await getDb().execute(
    'UPDATE _zenku_user_identities SET refresh_token = ? WHERE user_id = ? AND provider_id = ?',
    [refreshToken, userId, providerId]
  );
}

async function findUserByEmail(email: string): Promise<{ id: string; password_hash: string } | null> {
  const { rows } = await getDb().query<{ id: string; password_hash: string }>(
    'SELECT id, password_hash FROM _zenku_users WHERE email = ?',
    [email]
  );
  return rows[0] ?? null;
}

// ── Role Mappings ─────────────────────────────────────────────────────────────

export interface RoleMapping {
  id: string;
  provider_id: string;
  claim_path: string;
  claim_value: string;
  zenku_role: 'admin' | 'builder' | 'user';
  created_at: string;
}

export async function listRoleMappings(providerId: string): Promise<RoleMapping[]> {
  const { rows } = await getDb().query<RoleMapping>(
    'SELECT * FROM _zenku_oidc_role_mappings WHERE provider_id = ? ORDER BY created_at ASC',
    [providerId]
  );
  return rows;
}

export async function createRoleMapping(
  providerId: string, claimPath: string, claimValue: string, zenkuRole: string
): Promise<RoleMapping> {
  const id = crypto.randomUUID();
  await getDb().execute(
    'INSERT INTO _zenku_oidc_role_mappings (id, provider_id, claim_path, claim_value, zenku_role) VALUES (?, ?, ?, ?, ?)',
    [id, providerId, claimPath, claimValue, zenkuRole]
  );
  const { rows } = await getDb().query<RoleMapping>('SELECT * FROM _zenku_oidc_role_mappings WHERE id = ?', [id]);
  return rows[0]!;
}

export async function deleteRoleMapping(id: string): Promise<boolean> {
  const result = await getDb().execute('DELETE FROM _zenku_oidc_role_mappings WHERE id = ?', [id]);
  return result.rowsAffected > 0;
}

function getNestedClaim(claims: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((obj, key) => {
    if (obj !== null && typeof obj === 'object') return (obj as Record<string, unknown>)[key];
    return undefined;
  }, claims);
}

export function resolveRoleFromClaims(
  claims: Record<string, unknown>,
  mappings: RoleMapping[]
): 'admin' | 'builder' | 'user' | null {
  for (const m of mappings) {
    const val = getNestedClaim(claims, m.claim_path);
    const matches = Array.isArray(val) ? val.includes(m.claim_value) : val === m.claim_value;
    if (matches) return m.zenku_role;
  }
  return null;
}

// ── User provisioning ─────────────────────────────────────────────────────────

export async function provisionOidcUser(
  providerId: string,
  externalId: string,
  email: string,
  name: string,
  refreshToken?: string | null,
  resolvedRole?: 'admin' | 'builder' | 'user' | null,
): Promise<{ userId: string; isNew: boolean }> {
  const db = getDb();

  const existingIdentity = await findIdentity(providerId, externalId);
  if (existingIdentity) {
    const updates: Promise<unknown>[] = [];
    if (refreshToken !== undefined) {
      updates.push(updateRefreshToken(existingIdentity.user_id, providerId, refreshToken ?? null));
    }
    if (resolvedRole) {
      updates.push(db.execute('UPDATE _zenku_users SET role = ? WHERE id = ?', [resolvedRole, existingIdentity.user_id]));
    }
    await Promise.all(updates);
    return { userId: existingIdentity.user_id, isNew: false };
  }

  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    throw new Error('ERROR_EMAIL_TAKEN_LOCAL');
  }

  const userId = crypto.randomUUID();
  const unusableHash = await bcrypt.hash(crypto.randomUUID(), 10);
  const { rows: countRows } = await db.query<{ count: number }>('SELECT COUNT(*) as count FROM _zenku_users');
  const isFirst = (countRows[0]?.count ?? 0) === 0;
  const role = isFirst ? 'admin' : (resolvedRole ?? 'user');

  await db.execute(
    'INSERT INTO _zenku_users (id, email, name, password_hash, role, language) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, email, name, unusableHash, role, 'en']
  );

  const identityId = crypto.randomUUID();
  await db.execute(
    'INSERT INTO _zenku_user_identities (id, user_id, provider_id, external_id, refresh_token) VALUES (?, ?, ?, ?, ?)',
    [identityId, userId, providerId, externalId, refreshToken ?? null]
  );

  return { userId, isNew: true };
}
