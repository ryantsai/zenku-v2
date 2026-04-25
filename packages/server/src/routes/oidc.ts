import { Router } from 'express';
import { Issuer, generators } from 'openid-client';
import { getDb, dbNow, dbSessionExpiry } from '../db';
import {
  getOidcProvider, listOidcProviders, provisionOidcUser,
  findIdentityByUserId, updateRefreshToken,
  listRoleMappings, resolveRoleFromClaims,
} from '../db/oidc';
import { requireAuth } from '../middleware/auth';

const router = Router();

// State entries expire after 10 minutes
interface StateEntry {
  providerId: string;
  codeVerifier: string;
  returnTo: string;
  expiresAt: number;
}

const pendingStates = new Map<string, StateEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of pendingStates) {
    if (v.expiresAt < now) pendingStates.delete(k);
  }
}, 60_000);

function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
}

function getRedirectUri(req: import('express').Request): string {
  const baseUrl = process.env.APP_URL ?? `${req.protocol}://${req.get('host')}`;
  return `${baseUrl}/api/auth/oidc/callback`;
}

function getFrontendUrl(req: import('express').Request): string {
  return process.env.FRONTEND_URL ?? process.env.APP_URL ?? `${req.protocol}://${req.get('host')}`;
}

// Public: list enabled providers for login page
router.get('/auth/oidc/providers', async (_req, res) => {
  try {
    const providers = await listOidcProviders(true);
    res.json(providers.map(p => ({ id: p.id, name: p.name })));
  } catch {
    res.json([]);
  }
});

// Initiate OIDC login
router.get('/auth/oidc/:providerId/login', async (req, res) => {
  try {
    const provider = await getOidcProvider(req.params.providerId);
    if (!provider || !provider.enabled) {
      res.status(404).json({ error: 'OIDC provider not found' });
      return;
    }

    const issuer = await Issuer.discover(provider.issuer);
    const client = new issuer.Client({
      client_id: provider.client_id,
      client_secret: provider.client_secret,
      redirect_uris: [getRedirectUri(req)],
      response_types: ['code'],
    });

    const codeVerifier = generators.codeVerifier();
    const codeChallenge = generators.codeChallenge(codeVerifier);
    const state = generators.state();

    pendingStates.set(state, {
      providerId: provider.id,
      codeVerifier,
      returnTo: getFrontendUrl(req),
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    const authUrl = client.authorizationUrl({
      scope: 'openid email profile',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
    });

    res.redirect(authUrl);
  } catch (err) {
    res.status(500).json({ error: 'Failed to initiate OIDC login' });
  }
});

// OIDC callback
router.get('/auth/oidc/callback', async (req, res) => {
  const { state, error } = req.query as Record<string, string>;

  if (error) {
    const entry = state ? pendingStates.get(state) : null;
    const returnTo = entry?.returnTo ?? getFrontendUrl(req);
    if (state) pendingStates.delete(state);
    res.redirect(`${returnTo}/?oidc_error=${encodeURIComponent(error)}`);
    return;
  }

  if (!state || !pendingStates.has(state)) {
    res.status(400).send('Invalid or expired state');
    return;
  }

  const entry = pendingStates.get(state)!;
  pendingStates.delete(state);

  if (entry.expiresAt < Date.now()) {
    res.status(400).send('State expired');
    return;
  }

  try {
    const provider = await getOidcProvider(entry.providerId);
    if (!provider) throw new Error('Provider not found');

    const redirectUri = getRedirectUri(req);
    const issuer = await Issuer.discover(provider.issuer);
    const client = new issuer.Client({
      client_id: provider.client_id,
      client_secret: provider.client_secret,
      redirect_uris: [redirectUri],
      response_types: ['code'],
    });

    const params = client.callbackParams(req);
    const tokenSet = await client.callback(redirectUri, params, {
      code_verifier: entry.codeVerifier,
      state,
    });

    const claims = tokenSet.claims();
    const externalId = claims.sub;
    const email = claims.email as string | undefined;
    const name = (claims.name ?? claims.email ?? externalId) as string;
    const refreshToken = tokenSet.refresh_token ?? null;

    if (!email) {
      res.redirect(`${entry.returnTo}/?oidc_error=${encodeURIComponent('no_email')}`);
      return;
    }

    const mappings = await listRoleMappings(entry.providerId);
    const resolvedRole = resolveRoleFromClaims(claims as Record<string, unknown>, mappings);
    const { userId } = await provisionOidcUser(entry.providerId, externalId, email, name, refreshToken, resolvedRole);

    const db = getDb();
    const { rows } = await db.query<{ id: string; email: string; name: string; role: string; language: string }>(
      'SELECT id, email, name, role, language FROM _zenku_users WHERE id = ?',
      [userId]
    );
    const user = rows[0];
    if (!user) throw new Error('User not found after provisioning');

    const token = generateToken();
    const sessionId = crypto.randomUUID();
    await db.execute(
      'INSERT INTO _zenku_sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)',
      [sessionId, userId, token, dbSessionExpiry()]
    );

    await db.execute('UPDATE _zenku_users SET last_login_at = ? WHERE id = ?', [dbNow(), userId]);
    res.redirect(`${entry.returnTo}/?oidc_token=${encodeURIComponent(token)}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown';
    if (msg === 'ERROR_EMAIL_TAKEN_LOCAL') {
      res.redirect(`${entry.returnTo}/?oidc_error=${encodeURIComponent('email_taken_local')}`);
    } else {
      res.redirect(`${entry.returnTo}/?oidc_error=${encodeURIComponent('auth_failed')}`);
    }
  }
});

// Refresh OIDC session using stored refresh token
router.post('/auth/oidc/refresh', requireAuth, async (req, res) => {
  const { provider_id } = req.body as { provider_id?: string };
  if (!provider_id) {
    res.status(400).json({ error: 'ERROR_MISSING_FIELDS' });
    return;
  }

  try {
    const identity = await findIdentityByUserId(req.user!.id, provider_id);
    if (!identity?.refresh_token) {
      res.status(404).json({ error: 'NO_REFRESH_TOKEN' });
      return;
    }

    const provider = await getOidcProvider(provider_id);
    if (!provider) {
      res.status(404).json({ error: 'PROVIDER_NOT_FOUND' });
      return;
    }

    const issuer = await Issuer.discover(provider.issuer);
    const client = new issuer.Client({
      client_id: provider.client_id,
      client_secret: provider.client_secret,
      redirect_uris: [getRedirectUri(req)],
      response_types: ['code'],
    });

    const tokenSet = await client.refresh(identity.refresh_token);
    const db = getDb();
    const claims = tokenSet.claims();

    const updates: Promise<unknown>[] = [
      updateRefreshToken(req.user!.id, provider_id, tokenSet.refresh_token ?? identity.refresh_token),
    ];
    if (typeof claims.name === 'string') {
      updates.push(db.execute('UPDATE _zenku_users SET name = ? WHERE id = ?', [claims.name, req.user!.id]));
    }
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      updates.push(db.execute('UPDATE _zenku_sessions SET expires_at = ? WHERE token = ?', [dbSessionExpiry(), token]));
    }
    await Promise.all(updates);

    res.json({ success: true });
  } catch {
    res.status(401).json({ error: 'REFRESH_FAILED' });
  }
});

export default router;
