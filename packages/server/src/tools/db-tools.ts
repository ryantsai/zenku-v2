import { getDb, getTableSchema, getAllSchemas, logChange, writeJournal } from '../db';
import type { AgentResult } from '../types';

const ALLOWED_TYPES = new Set(['TEXT', 'INTEGER', 'REAL', 'BLOB', 'BOOLEAN', 'DATE', 'DATETIME']);
const FORBIDDEN_TABLE_PREFIXES = ['_zenku_', 'sqlite_'];

function isSafeTableName(name: string): boolean {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) return false;
  if (FORBIDDEN_TABLE_PREFIXES.some(p => name.toLowerCase().startsWith(p))) return false;
  return true;
}

function isSafeFieldName(name: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

interface ReferenceDef {
  table: string;
  column?: string;
}

interface ColumnInput {
  name: string;
  type: string;
  required?: boolean;
  default_value?: string;
  options?: string[];
  references?: ReferenceDef;
}

export function createTable(
  tableName: string,
  columns: ColumnInput[],
  userRequest: string
): AgentResult {
  if (!isSafeTableName(tableName)) {
    return { success: false, message: `無效的表名：${tableName}` };
  }

  const db = getDb();

  const existing = db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
  ).get(tableName);
  if (existing) {
    return { success: false, message: `表 ${tableName} 已存在` };
  }

  const colDefs = columns.map(col => {
    const type = col.type.toUpperCase();
    if (!ALLOWED_TYPES.has(type)) {
      throw new Error(`不支援的型別：${col.type}`);
    }
    let def = `"${col.name}" ${type}`;
    if (col.required) def += ' NOT NULL';
    if (col.references) {
      const refTable = col.references.table;
      const refCol = col.references.column ?? 'id';
      if (!isSafeTableName(refTable)) throw new Error(`無效的關聯表名：${refTable}`);
      def += ` REFERENCES "${refTable}"("${refCol}")`;
    }
    return def;
  });

  const sql = `CREATE TABLE "${tableName}" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ${colDefs.join(',\n    ')},
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`;

  db.exec(sql);
  logChange('schema-agent', 'create_table', { tableName, columns }, userRequest);
  writeJournal({
    agent: 'schema',
    type: 'schema_change',
    description: `建立表 ${tableName}（欄位：${columns.map(c => c.name).join(', ')}）`,
    diff: { before: null, after: { table: tableName, columns } },
    user_request: userRequest,
    reversible: true,
    reverse_operations: [{ type: 'sql', sql: `DROP TABLE IF EXISTS "${tableName}"` }],
  });

  return {
    success: true,
    message: `已建立表 ${tableName}，包含欄位：${columns.map(c => c.name).join(', ')}`,
    data: getTableSchema(tableName),
  };
}

interface AlterInput {
  operation: 'add_column';
  column: ColumnInput;
}

export function alterTable(
  tableName: string,
  changes: AlterInput[],
  userRequest: string
): AgentResult {
  if (!isSafeTableName(tableName)) {
    return { success: false, message: `無效的表名：${tableName}` };
  }

  const db = getDb();
  const results: string[] = [];

  for (const change of changes) {
    if (change.operation === 'add_column') {
      const col = change.column;
      const type = col.type.toUpperCase();
      if (!ALLOWED_TYPES.has(type)) {
        return { success: false, message: `不支援的型別：${col.type}` };
      }

      let colDef = `"${col.name}" ${type}`;
      if (col.references) {
        const refTable = col.references.table;
        const refCol = col.references.column ?? 'id';
        if (!isSafeTableName(refTable)) {
          return { success: false, message: `無效的關聯表名：${refTable}` };
        }
        colDef += ` REFERENCES "${refTable}"("${refCol}")`;
      }

      db.exec(`ALTER TABLE "${tableName}" ADD COLUMN ${colDef}`);
      results.push(`新增欄位 ${col.name}`);

      writeJournal({
        agent: 'schema',
        type: 'schema_change',
        description: `在表 ${tableName} 新增欄位 ${col.name}（${col.type}）`,
        diff: { before: null, after: { table: tableName, column: col } },
        user_request: userRequest,
        reversible: true,
        reverse_operations: [{ type: 'drop_column', table: tableName, column: col.name }],
      });
    }
  }

  logChange('schema-agent', 'alter_table', { tableName, changes }, userRequest);

  return {
    success: true,
    message: `已修改表 ${tableName}：${results.join(', ')}`,
    data: getTableSchema(tableName),
  };
}

export function describeTables(): AgentResult {
  const schemas = getAllSchemas();
  return {
    success: true,
    message: '目前資料庫結構',
    data: schemas,
  };
}

export function queryData(sql: string): AgentResult {
  const trimmed = sql.trim().toUpperCase();
  if (!trimmed.startsWith('SELECT')) {
    return { success: false, message: '只允許 SELECT 查詢' };
  }

  const db = getDb();
  const rows = db.prepare(sql).all();
  return {
    success: true,
    message: `查詢完成，共 ${rows.length} 筆`,
    data: rows,
  };
}

// ===== Write data =====

type WriteOperation = 'insert' | 'update' | 'delete';
type ScalarValue = string | number | boolean | null;

/** node:sqlite 不接受 boolean，轉成 0/1 */
function toSQLValue(v: ScalarValue): string | number | null | bigint {
  if (typeof v === 'boolean') return v ? 1 : 0;
  return v;
}

interface WriteDataInput {
  operation: WriteOperation;
  table: string;
  data?: Record<string, ScalarValue>;
  where?: Record<string, ScalarValue>;
}

export function writeData(input: WriteDataInput, userRequest: string): AgentResult {
  const { operation, table, data = {}, where } = input;

  if (!isSafeTableName(table)) {
    return { success: false, message: `無效或不允許操作的表名：${table}` };
  }

  const db = getDb();
  const tableExists = db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
  ).get(table);
  if (!tableExists) {
    return { success: false, message: `表 ${table} 不存在` };
  }

  // Validate all field names
  const allKeys = [...Object.keys(data), ...Object.keys(where ?? {})];
  for (const k of allKeys) {
    if (!isSafeFieldName(k)) {
      return { success: false, message: `無效的欄位名：${k}` };
    }
  }

  if (operation === 'insert') {
    const keys = Object.keys(data);
    if (keys.length === 0) return { success: false, message: '新增資料不能為空' };

    const cols = keys.map(k => `"${k}"`).join(', ');
    const placeholders = keys.map(() => '?').join(', ');
    const values = keys.map(k => data[k]);

    const result = db.prepare(
      `INSERT INTO "${table}" (${cols}) VALUES (${placeholders})`
    ).run(...values.map(toSQLValue));

    const insertedId = result.lastInsertRowid;

    writeJournal({
      agent: 'user',
      type: 'data_write',
      description: `AI 新增一筆資料到 ${table}（id: ${insertedId}）`,
      diff: { before: null, after: { table, data } },
      user_request: userRequest,
      reversible: true,
      reverse_operations: [{ type: 'sql', sql: `DELETE FROM "${table}" WHERE id = ${insertedId}` }],
    });

    return {
      success: true,
      message: `已新增一筆資料到 ${table}，id = ${insertedId}`,
      data: { id: Number(insertedId) },
    };
  }

  if (operation === 'update') {
    const whereKeys = Object.keys(where ?? {});
    if (whereKeys.length === 0) {
      return { success: false, message: 'update 必須提供 where 條件，不可全表更新' };
    }
    const dataKeys = Object.keys(data);
    if (dataKeys.length === 0) return { success: false, message: '更新欄位不能為空' };

    const sets = dataKeys.map(k => `"${k}" = ?`).join(', ');
    const wheres = whereKeys.map(k => `"${k}" = ?`).join(' AND ');
    const values = [
      ...dataKeys.map(k => data[k]),
      ...whereKeys.map(k => (where as Record<string, ScalarValue>)[k]),
    ];

    const result = db.prepare(
      `UPDATE "${table}" SET ${sets} WHERE ${wheres}`
    ).run(...values.map(toSQLValue));

    writeJournal({
      agent: 'user',
      type: 'data_write',
      description: `AI 更新 ${table} 中 ${result.changes} 筆資料`,
      diff: { before: where ?? null, after: { ...where, ...data } },
      user_request: userRequest,
      reversible: false,
    });

    return {
      success: true,
      message: `已更新 ${result.changes} 筆資料`,
      data: { changes: result.changes },
    };
  }

  if (operation === 'delete') {
    const whereKeys = Object.keys(where ?? {});
    if (whereKeys.length === 0) {
      return { success: false, message: 'delete 必須提供 where 條件，不可全表刪除' };
    }

    const wheres = whereKeys.map(k => `"${k}" = ?`).join(' AND ');
    const values = whereKeys.map(k => (where as Record<string, ScalarValue>)[k]);

    const result = db.prepare(
      `DELETE FROM "${table}" WHERE ${wheres}`
    ).run(...values.map(toSQLValue));

    writeJournal({
      agent: 'user',
      type: 'data_write',
      description: `AI 刪除 ${table} 中 ${result.changes} 筆資料`,
      diff: { before: where ?? null, after: null },
      user_request: userRequest,
      reversible: false,
    });

    return {
      success: true,
      message: `已刪除 ${result.changes} 筆資料`,
      data: { changes: result.changes },
    };
  }

  return { success: false, message: `不支援的操作類型：${String(operation)}` };
}
