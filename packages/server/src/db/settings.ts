import { getDb, dbNow } from './index';

export async function getSetting(key: string, defaultValue = ''): Promise<string> {
  const { rows } = await getDb().query<{ value: string }>(
    'SELECT value FROM _zenku_settings WHERE key = ?',
    [key]
  );
  return rows[0]?.value ?? defaultValue;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = getDb();
  const result = await db.execute(
    'UPDATE _zenku_settings SET value = ?, updated_at = ? WHERE key = ?',
    [value, dbNow(), key]
  );
  if (result.rowsAffected === 0) {
    try {
      await db.execute(
        'INSERT INTO _zenku_settings (key, value, updated_at) VALUES (?, ?, ?)',
        [key, value, dbNow()]
      );
    } catch {
      await db.execute(
        'UPDATE _zenku_settings SET value = ?, updated_at = ? WHERE key = ?',
        [value, dbNow(), key]
      );
    }
  }
}

export async function getAuthMode(): Promise<'local' | 'sso_only'> {
  const val = await getSetting('auth_mode', 'local');
  return val === 'sso_only' ? 'sso_only' : 'local';
}
