import { getDb } from './index';
import type { ColumnInfo } from './adapter';

export type { ColumnInfo };

export async function getUserTables(): Promise<string[]> {
  return getDb().listTables();
}

export async function getTableSchema(tableName: string): Promise<ColumnInfo[]> {
  return getDb().getColumns(tableName);
}

export async function getAllSchemas(): Promise<Record<string, ColumnInfo[]>> {
  const tables = await getUserTables();
  const result: Record<string, ColumnInfo[]> = {};
  for (const table of tables) {
    result[table] = await getTableSchema(table);
  }
  return result;
}
