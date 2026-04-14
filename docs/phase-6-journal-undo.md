# Phase 6：Design Journal + Undo 機制

> **目標：** 跨 session 記憶 + 任意回滾，讓使用者能安心「試了再說」。
> **建議模型：Sonnet**（邏輯清晰，資料表操作）

---

## 6.1 Design Journal 系統表

### 升級 `_zenku_changes` 為 `_zenku_journal`

```sql
-- 替換現有的 _zenku_changes
CREATE TABLE _zenku_journal (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT DEFAULT (datetime('now')),
  session_id TEXT NOT NULL,
  agent TEXT NOT NULL,            -- 'schema' | 'ui' | 'logic' | ...
  type TEXT NOT NULL,             -- 'schema_change' | 'view_change' | 'rule_change' | ...
  description TEXT NOT NULL,      -- 人可讀描述
  diff TEXT NOT NULL,             -- JSON: { before, after }
  reason TEXT,                    -- 為什麼做這個決定
  user_request TEXT,              -- 原始使用者需求
  reversible BOOLEAN DEFAULT 1,
  reverse_operations TEXT,        -- JSON: 回滾用的 SQL / 操作
  reversed BOOLEAN DEFAULT 0,    -- 是否已被回滾
  reversed_by INTEGER            -- 指向回滾動作的 journal id
);

CREATE INDEX idx_journal_session ON _zenku_journal(session_id);
CREATE INDEX idx_journal_timestamp ON _zenku_journal(timestamp);
```

---

## 6.2 Journal 寫入

### journal-tools.ts

```typescript
// server/src/tools/journal-tools.ts
import { getDb } from '../db';
import type { JournalEntry } from '@zenku/shared';

let currentSessionId: string | null = null;

export function setSessionId(id: string) {
  currentSessionId = id;
}

export function getSessionId(): string {
  if (!currentSessionId) {
    currentSessionId = crypto.randomUUID();
  }
  return currentSessionId;
}

export function writeJournal(
  entry: Omit<JournalEntry, 'id' | 'timestamp' | 'session_id'>
): number {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO _zenku_journal
    (session_id, agent, type, description, diff, reason, user_request, reversible, reverse_operations)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    getSessionId(),
    entry.agent,
    entry.type,
    entry.description,
    JSON.stringify(entry.diff),
    entry.reason ?? '',
    entry.user_request ?? '',
    entry.reversible ? 1 : 0,
    entry.reverse_operations ?? null
  );
  return Number(result.lastInsertRowid);
}

export function getRecentJournal(limit: number = 50): JournalEntry[] {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM _zenku_journal WHERE reversed = 0 ORDER BY id DESC LIMIT ?'
  ).all(limit) as JournalEntry[];
}
```

### 各 Agent 寫入範例

```typescript
// schema-agent.ts — createTable 時
writeJournal({
  agent: 'schema',
  type: 'schema_change',
  description: `建立表 ${tableName}，欄位：${columns.map(c => c.name).join(', ')}`,
  diff: {
    before: null,
    after: { table: tableName, columns }
  },
  reason: '使用者要求建立新資料類型',
  user_request: userRequest,
  reversible: true,
  reverse_operations: JSON.stringify([
    { type: 'sql', sql: `DROP TABLE IF EXISTS "${tableName}"` }
  ])
});

// schema-agent.ts — alterTable 時
writeJournal({
  agent: 'schema',
  type: 'schema_change',
  description: `在 ${tableName} 新增欄位 ${col.name}`,
  diff: {
    before: { columns: existingColumns },
    after: { columns: [...existingColumns, col] }
  },
  reversible: true, // SQLite 不完全支援 DROP COLUMN，需要重建表
  reverse_operations: JSON.stringify([
    { type: 'rebuild_table_without_column', table: tableName, column: col.name }
  ])
});

// ui-agent.ts — createView 時
writeJournal({
  agent: 'ui',
  type: 'view_change',
  description: `建立介面「${view.name}」`,
  diff: {
    before: null,
    after: view
  },
  reversible: true,
  reverse_operations: JSON.stringify([
    { type: 'sql', sql: `DELETE FROM _zenku_views WHERE id = '${view.id}'` }
  ])
});
```

---

## 6.3 Undo 機制

### Orchestrator Tool

```typescript
{
  name: 'undo_action',
  description: '復原上一個操作，或復原到指定時間點',
  input_schema: {
    properties: {
      target: {
        type: 'string',
        enum: ['last', 'by_id', 'by_time'],
        description: 'last=最近一筆, by_id=指定 journal id, by_time=指定時間之後全部'
      },
      journal_id: { type: 'number' },
      since: { type: 'string', description: 'ISO timestamp, by_time 時使用' }
    },
    required: ['target']
  }
}
```

### Undo 執行邏輯

```typescript
// server/src/tools/journal-tools.ts

interface ReverseOp =
  | { type: 'sql'; sql: string }
  | { type: 'rebuild_table_without_column'; table: string; column: string }
  | { type: 'restore_view'; view: ViewDefinition };

export function undoJournalEntry(entryId: number): AgentResult {
  const db = getDb();
  const entry = db.prepare('SELECT * FROM _zenku_journal WHERE id = ?').get(entryId);

  if (!entry) return { success: false, message: '找不到該操作記錄' };
  if (!entry.reversible) return { success: false, message: '此操作無法復原' };
  if (entry.reversed) return { success: false, message: '此操作已經被復原過' };

  const ops: ReverseOp[] = JSON.parse(entry.reverse_operations);

  for (const op of ops) {
    if (op.type === 'sql') {
      db.exec(op.sql);
    } else if (op.type === 'rebuild_table_without_column') {
      rebuildTableWithoutColumn(op.table, op.column);
    } else if (op.type === 'restore_view') {
      // 還原 view 定義
    }
  }

  // 標記為已回滾
  db.prepare('UPDATE _zenku_journal SET reversed = 1, reversed_by = ? WHERE id = ?')
    .run(/* new undo journal entry id */, entryId);

  return { success: true, message: `已復原：${entry.description}` };
}

export function undoSince(timestamp: string): AgentResult {
  const entries = db.prepare(
    'SELECT * FROM _zenku_journal WHERE timestamp >= ? AND reversed = 0 AND reversible = 1 ORDER BY id DESC'
  ).all(timestamp);

  let undone = 0;
  for (const entry of entries) {
    const result = undoJournalEntry(entry.id);
    if (result.success) undone++;
  }

  return { success: true, message: `已復原 ${undone} 個操作` };
}
```

### SQLite DROP COLUMN 替代方案

SQLite 3.35+ 支援 `ALTER TABLE DROP COLUMN`，之前版本需要重建表：

```typescript
function rebuildTableWithoutColumn(table: string, column: string) {
  const db = getDb();
  const schema = getTableSchema(table);
  const remainingCols = schema.filter(c => c.name !== column && c.name !== 'id'
    && c.name !== 'created_at' && c.name !== 'updated_at');

  const colNames = remainingCols.map(c => `"${c.name}"`).join(', ');

  db.exec(`
    CREATE TABLE "${table}_backup" AS SELECT id, ${colNames}, created_at, updated_at FROM "${table}";
    DROP TABLE "${table}";
    ALTER TABLE "${table}_backup" RENAME TO "${table}";
  `);
}
```

---

## 6.4 Session 記憶

### Orchestrator System Prompt 增強

```typescript
function buildSystemPrompt(userRole: UserRole): string {
  // ... 現有 schema + views 資訊

  // 加入最近操作摘要
  const journal = getRecentJournal(20);
  const journalStr = journal.length > 0
    ? journal.map(j =>
        `- ${j.timestamp}: ${j.description}（${j.user_request}）`
      ).join('\n')
    : '（無操作記錄）';

  return `...
最近操作紀錄：
${journalStr}
...`;
}
```

### 摘要壓縮（Journal 過多時）

```typescript
// 當 journal 超過 50 筆時，呼叫 Claude 壓縮
async function summarizeJournal(entries: JournalEntry[]): Promise<string> {
  const summary = await getClient().messages.create({
    model: 'claude-haiku-4-5-20251001', // 用便宜的模型做摘要
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `請用繁體中文摘要以下操作紀錄（保留關鍵資訊：建了哪些表、哪些欄位、哪些介面、哪些規則）：\n\n${
        entries.map(e => `${e.timestamp}: ${e.description}`).join('\n')
      }`
    }]
  });
  return summary.content[0].text;
}
```

---

## 對話→動作 範例

```
使用者：「復原剛才的操作」
Orchestrator → undo_action({ target: 'last' })

使用者：「把訂單表回到今天早上的版本」
Orchestrator → undo_action({ target: 'by_time', since: '2026-04-13T00:00:00' })

使用者：「我之前做了什麼？」
→ Orchestrator 直接從 system prompt 裡的操作紀錄回答
```

---

## 驗收標準

- [x] 每次 agent 操作都寫入 journal
- [x] 「復原剛才的操作」→ 正確回滾最近一筆
- [x] 「回到昨天的版本」→ 批次回滾
- [x] 新 session 開始時，AI 知道之前做了什麼（journal 注入 system prompt）
- [ ] 不可逆操作（如已匯入大量資料後改結構）給出警告

---

## 實作紀錄（2026-04-14）

### 已完成

- `_zenku_journal` 表建立（db.ts）：`id`, `session_id`, `agent`, `type`, `description`, `diff`, `user_request`, `reversible`, `reverse_operations`, `reversed`, `reversed_by`, `timestamp`
- `getSessionId()`：每個 server 程序一個 UUID session
- `writeJournal()` / `getRecentJournal()` / `JournalRow` / `ReverseOp` 介面
- journal 寫入點：
  - `db-tools.ts`：create_table（DROP TABLE 回滾）、add_column（DROP COLUMN 回滾）
  - `view-tools.ts`：create_view（DELETE 回滾）、update_view（UPDATE 還原舊定義）
  - `logic-agent.ts`：create_rule（DELETE 回滾）、delete_rule（INSERT 還原）
- `journal-tools.ts`：`undoLast()`, `undoById()`, `undoSince()`, `buildJournalContext()`
  - `ReverseOp` 支援 `sql`（直接 exec）和 `drop_column`（ALTER TABLE DROP COLUMN）
- `orchestrator.ts`：
  - import journal-tools
  - 新增 `undo_action` 工具（last / by_id / by_time）
  - `chat()` dispatch undo_action
  - `buildSystemPrompt()` 末尾注入 `buildJournalContext()` 輸出

### 待完成

- [ ] 不可逆操作警告（大量資料匯入後的結構變更）
- [ ] Journal 壓縮（超過 50 筆時用 Haiku 做摘要）
