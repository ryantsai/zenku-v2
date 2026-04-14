import { getDb, getTableSchema, writeJournal, getRecentJournal, type JournalRow, type ReverseOp } from '../db';
import type { AgentResult } from '../types';

export { writeJournal, getRecentJournal };

// ===== Undo =====

function executeReverseOp(op: ReverseOp): void {
  const db = getDb();
  if (op.type === 'sql' && op.sql) {
    db.exec(op.sql);
  } else if (op.type === 'drop_column' && op.table && op.column) {
    // SQLite 3.35+ supports DROP COLUMN directly
    db.exec(`ALTER TABLE "${op.table}" DROP COLUMN "${op.column}"`);
  }
}

function undoEntry(entry: JournalRow, reversedBy: number): AgentResult {
  if (!entry.reversible) return { success: false, message: `操作「${entry.description}」不可復原` };
  if (entry.reversed) return { success: false, message: `操作「${entry.description}」已經被復原過` };
  if (!entry.reverse_operations) return { success: false, message: `操作「${entry.description}」沒有復原資訊` };

  const ops: ReverseOp[] = JSON.parse(entry.reverse_operations);

  try {
    for (const op of ops) {
      executeReverseOp(op);
    }
  } catch (err) {
    return { success: false, message: `復原失敗：${String(err)}` };
  }

  const db = getDb();
  db.prepare('UPDATE _zenku_journal SET reversed = 1, reversed_by = ? WHERE id = ?')
    .run(reversedBy, entry.id);

  return { success: true, message: `已復原：${entry.description}` };
}

export function undoLast(userRequest: string): AgentResult {
  const db = getDb();
  const entry = db.prepare(
    'SELECT * FROM _zenku_journal WHERE reversed = 0 AND reversible = 1 ORDER BY id DESC LIMIT 1'
  ).get() as JournalRow | undefined;

  if (!entry) return { success: false, message: '沒有可以復原的操作' };

  // Write undo journal entry first
  const undoId = writeJournal({
    agent: 'undo',
    type: 'undo',
    description: `復原：${entry.description}`,
    diff: { before: entry.description, after: null },
    user_request: userRequest,
    reversible: false,
  });

  return undoEntry(entry, undoId);
}

export function undoById(journalId: number, userRequest: string): AgentResult {
  const db = getDb();
  const entry = db.prepare('SELECT * FROM _zenku_journal WHERE id = ?').get(journalId) as JournalRow | undefined;

  if (!entry) return { success: false, message: `找不到 journal 記錄 #${journalId}` };

  const undoId = writeJournal({
    agent: 'undo',
    type: 'undo',
    description: `復原：${entry.description}`,
    diff: { before: entry.description, after: null },
    user_request: userRequest,
    reversible: false,
  });

  return undoEntry(entry, undoId);
}

export function undoSince(since: string, userRequest: string): AgentResult {
  const db = getDb();
  const entries = db.prepare(
    "SELECT * FROM _zenku_journal WHERE timestamp >= ? AND reversed = 0 AND reversible = 1 ORDER BY id DESC"
  ).all(since) as unknown as JournalRow[];

  if (entries.length === 0) return { success: false, message: `${since} 之後沒有可復原的操作` };

  const undoId = writeJournal({
    agent: 'undo',
    type: 'undo',
    description: `批次復原 ${entries.length} 個操作（自 ${since}）`,
    diff: { before: entries.map(e => e.description), after: null },
    user_request: userRequest,
    reversible: false,
  });

  const results: string[] = [];
  let failCount = 0;

  for (const entry of entries) {
    const r = undoEntry(entry, undoId);
    if (r.success) results.push(entry.description);
    else failCount++;
  }

  return {
    success: true,
    message: `已復原 ${results.length} 個操作${failCount > 0 ? `，${failCount} 個失敗` : ''}`,
    data: { undone: results, failed: failCount },
  };
}

// ===== Journal summary for system prompt =====

export function buildJournalContext(): string {
  const entries = getRecentJournal(20);
  if (entries.length === 0) return '（無操作記錄）';

  return entries
    .slice()
    .reverse() // chronological order
    .map(e => `[${e.timestamp.slice(0, 16)}] ${e.description}${e.user_request ? `（原因：${e.user_request}）` : ''}`)
    .join('\n');
}
