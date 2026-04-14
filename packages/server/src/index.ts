import dotenv from 'dotenv';
import path from 'path';
// CWD = packages/server（npm workspace 執行時），往上兩層到 monorepo root
const envResult = dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
console.log('[dotenv] path:', path.resolve(process.cwd(), '../../.env'));
console.log('[dotenv] loaded:', !envResult.error, '| ANTHROPIC_API_KEY set:', !!process.env.ANTHROPIC_API_KEY);

import express from 'express';
import cors from 'cors';
import { getDb, getAllViews } from './db';
import { chat } from './orchestrator';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ──────────────────────────────────────────────
// Chat endpoint (SSE)
// ──────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { message, history = [] } = req.body as {
    message: string;
    history: { role: 'user' | 'assistant'; content: string }[];
  };

  if (!message) {
    res.status(400).json({ error: '缺少 message' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    for await (const chunk of chat(message, history)) {
      res.write(`data: ${chunk}\n`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.write(`data: ${JSON.stringify({ type: 'error', message: msg })}\n`);
  }

  res.end();
});

// ──────────────────────────────────────────────
// Views
// ──────────────────────────────────────────────
app.get('/api/views', (_req, res) => {
  const views = getAllViews();
  res.json(views.map(v => ({ ...v, definition: JSON.parse(v.definition) })));
});

// ──────────────────────────────────────────────
// Generic CRUD for user tables
// ──────────────────────────────────────────────
app.get('/api/data/:table', (req, res) => {
  const { table } = req.params;
  if (table.startsWith('_zenku_')) {
    res.status(403).json({ error: '不允許存取系統表' });
    return;
  }
  try {
    const db = getDb();
    const rows = db.prepare(`SELECT * FROM "${table}" ORDER BY id DESC`).all();
    res.json(rows);
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

app.post('/api/data/:table', (req, res) => {
  const { table } = req.params;
  if (table.startsWith('_zenku_')) {
    res.status(403).json({ error: '不允許存取系統表' });
    return;
  }
  try {
    const db = getDb();
    const body = { ...req.body } as Record<string, unknown>;
    delete body.id;
    delete body.created_at;
    delete body.updated_at;

    const keys = Object.keys(body);
    const placeholders = keys.map(() => '?').join(', ');
    const values = Object.values(body);

    const result = db.prepare(
      `INSERT INTO "${table}" (${keys.map(k => `"${k}"`).join(', ')}) VALUES (${placeholders})`
    ).run(...(values as (string | number | bigint | null)[]));


    const created = db.prepare(`SELECT * FROM "${table}" WHERE id = ?`).get(result.lastInsertRowid);
    res.json(created);
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

app.put('/api/data/:table/:id', (req, res) => {
  const { table, id } = req.params;
  if (table.startsWith('_zenku_')) {
    res.status(403).json({ error: '不允許存取系統表' });
    return;
  }
  try {
    const db = getDb();
    const body = { ...req.body } as Record<string, unknown>;
    delete body.id;
    delete body.created_at;
    body.updated_at = new Date().toISOString();

    const keys = Object.keys(body);
    const setClause = keys.map(k => `"${k}" = ?`).join(', ');
    const values = [...Object.values(body), id];

    db.prepare(`UPDATE "${table}" SET ${setClause} WHERE id = ?`).run(...(values as (string | number | bigint | null)[]));

    const updated = db.prepare(`SELECT * FROM "${table}" WHERE id = ?`).get(id);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

app.delete('/api/data/:table/:id', (req, res) => {
  const { table, id } = req.params;
  if (table.startsWith('_zenku_')) {
    res.status(403).json({ error: '不允許存取系統表' });
    return;
  }
  try {
    const db = getDb();
    db.prepare(`DELETE FROM "${table}" WHERE id = ?`).run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

// ──────────────────────────────────────────────
// Reset（刪除所有使用者資料表和 views）
// ──────────────────────────────────────────────
app.post('/api/reset', (_req, res) => {
  try {
    const db = getDb();
    const tables = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `).all() as { name: string }[];

    for (const { name } of tables) {
      db.exec(`DROP TABLE IF EXISTS "${name}"`);
    }

    // 重建系統表
    db.exec(`
      CREATE TABLE IF NOT EXISTS _zenku_views (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, table_name TEXT NOT NULL,
        definition TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS _zenku_changes (
        id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT DEFAULT (datetime('now')),
        agent TEXT NOT NULL, action TEXT NOT NULL, detail TEXT, user_request TEXT
      );
    `);

    res.json({ success: true, message: '已重置所有資料' });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ──────────────────────────────────────────────
// Health check
// ──────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Zenku server running on http://localhost:${PORT}`);
});
