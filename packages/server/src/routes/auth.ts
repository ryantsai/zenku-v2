import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../db';
import {
  requireAuth,
  registerHandler, loginHandler, meHandler, logoutHandler, statusHandler,
} from '../middleware/auth';

const router = Router();

router.get('/auth/status', (req, res) => { void statusHandler(req, res); });
router.post('/auth/register', (req, res) => { void registerHandler(req, res); });
router.post('/auth/login', (req, res) => { void loginHandler(req, res); });
router.get('/auth/me', requireAuth, meHandler);
router.post('/auth/logout', requireAuth, logoutHandler);

router.put('/users/me', requireAuth, async (req, res) => {
  const { name, language } = req.body as { name?: string; language?: string };
  if (!name || !name.trim()) {
    res.status(400).json({ error: 'ERROR_INVALID_NAME' });
    return;
  }
  const db = getDb();
  if (language) {
    await db.execute('UPDATE _zenku_users SET name = ?, language = ? WHERE id = ?', [name.trim(), language, req.user!.id]);
  } else {
    await db.execute('UPDATE _zenku_users SET name = ? WHERE id = ?', [name.trim(), req.user!.id]);
  }
  res.json({ success: true, name: name.trim(), language });
});

router.put('/users/me/password', requireAuth, async (req, res) => {
  const { old_password, new_password } = req.body as { old_password?: string; new_password?: string };
  if (!old_password || !new_password) {
    res.status(400).json({ error: 'ERROR_MISSING_FIELDS' });
    return;
  }
  if (new_password.length < 6) {
    res.status(400).json({ error: 'ERROR_PASSWORD_TOO_SHORT', params: { min: 6 } });
    return;
  }
  const db = getDb();
  const { rows } = await db.query<{ password_hash: string }>(
    'SELECT password_hash FROM _zenku_users WHERE id = ?',
    [req.user!.id]
  );
  if (!rows[0]) {
    res.status(404).json({ error: 'ERROR_USER_NOT_FOUND' });
    return;
  }
  const valid = await bcrypt.compare(old_password, rows[0].password_hash);
  if (!valid) {
    res.status(400).json({ error: 'ERROR_INVALID_PASSWORD' });
    return;
  }
  const hash = await bcrypt.hash(new_password, 12);
  await db.execute('UPDATE _zenku_users SET password_hash = ? WHERE id = ?', [hash, req.user!.id]);
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const currentToken = authHeader.slice(7);
    await db.execute('DELETE FROM _zenku_sessions WHERE user_id = ? AND token != ?', [req.user!.id, currentToken]);
  }
  res.json({ success: true });
});

export default router;
