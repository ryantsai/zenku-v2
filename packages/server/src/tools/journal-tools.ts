import { getDb } from '../db';
import { writeJournal, getRecentJournal, type JournalRow, type ReverseOp } from '../db/journal';
import type { AgentResult } from '../types';

export { writeJournal, getRecentJournal };

// ===== Undo =====

async function executeReverseOp(op: ReverseOp): Promise<void> {
  const db = getDb();
  if (op.type === 'sql' && op.sql) {
    await db.execute(op.sql);
  } else if (op.type === 'drop_column' && op.table && op.column) {
    await db.dropColumn(op.table, op.column);
  } else if (op.type === 'drop_table' && op.table) {
    await db.dropTable(op.table);
  }
}

async function undoEntry(entry: JournalRow, reversedBy: number): Promise<AgentResult> {
  if (!entry.reversible) return { success: false, message: `Operation "${entry.description}" is not reversible` };
  if (entry.reversed) return { success: false, message: `Operation "${entry.description}" has already been reversed` };
  if (!entry.reverse_operations) return { success: false, message: `Operation "${entry.description}" has no reversal information` };

  const ops: ReverseOp[] = JSON.parse(entry.reverse_operations);

  try {
    for (const op of ops) {
      await executeReverseOp(op);
    }
  } catch (err) {
    return { success: false, message: `Reversal failed: ${String(err)}` };
  }

  await getDb().execute(
    'UPDATE _zenku_journal SET reversed = 1, reversed_by = ? WHERE id = ?',
    [reversedBy, entry.id]
  );

  return { success: true, message: `Reversed: ${entry.description}` };
}

export async function undoLast(userRequest: string): Promise<AgentResult> {
  const { rows } = await getDb().query<JournalRow>(
    'SELECT * FROM _zenku_journal WHERE reversed = 0 AND reversible = 1 ORDER BY id DESC LIMIT 1'
  );
  const entry = rows[0];
  if (!entry) return { success: false, message: 'No reversible operations' };

  const undoId = await writeJournal({
    agent: 'undo',
    type: 'undo',
    description: `Undo: ${entry.description}`,
    diff: { before: entry.description, after: null },
    user_request: userRequest,
    reversible: false,
  });

  return undoEntry(entry, undoId);
}

export async function undoById(journalId: number, userRequest: string): Promise<AgentResult> {
  const { rows } = await getDb().query<JournalRow>(
    'SELECT * FROM _zenku_journal WHERE id = ?',
    [journalId]
  );
  const entry = rows[0];
  if (!entry) return { success: false, message: `Journal record #${journalId} not found` };

  const undoId = await writeJournal({
    agent: 'undo',
    type: 'undo',
    description: `Undo: ${entry.description}`,
    diff: { before: entry.description, after: null },
    user_request: userRequest,
    reversible: false,
  });

  return undoEntry(entry, undoId);
}

export async function undoSince(since: string, userRequest: string): Promise<AgentResult> {
  const { rows: entries } = await getDb().query<JournalRow>(
    "SELECT * FROM _zenku_journal WHERE timestamp >= ? AND reversed = 0 AND reversible = 1 ORDER BY id DESC",
    [since]
  );

  if (entries.length === 0) return { success: false, message: `No reversible operations after ${since}` };

  const undoId = await writeJournal({
    agent: 'undo',
    type: 'undo',
    description: `Batch undo ${entries.length} operations (since ${since})`,
    diff: { before: entries.map(e => e.description), after: null },
    user_request: userRequest,
    reversible: false,
  });

  const results: string[] = [];
  let failCount = 0;

  for (const entry of entries) {
    const r = await undoEntry(entry, undoId);
    if (r.success) results.push(entry.description);
    else failCount++;
  }

  return {
    success: true,
    message: `Reversed ${results.length} operations${failCount > 0 ? `, ${failCount} failed` : ''}`,
    data: { undone: results, failed: failCount },
  };
}

// ===== Journal summary for system prompt =====

export async function buildJournalContext(): Promise<string> {
  const entries = await getRecentJournal(20);
  if (entries.length === 0) return '(No operation history)';

  return entries
    .slice()
    .reverse()
    .map(e => `[${e.timestamp.slice(0, 16)}] ${e.description}${e.user_request ? ` (Reason: ${e.user_request})` : ''}`)
    .join('\n');
}
