import { getDb } from './index';

export interface ViewRow {
  id: string;
  name: string;
  table_name: string;
  definition: string;
  created_at: string;
  updated_at: string;
}

export async function getAllViews(): Promise<ViewRow[]> {
  const { rows } = await getDb().query<ViewRow>(
    'SELECT * FROM _zenku_views ORDER BY created_at'
  );
  return rows;
}

export async function getPrimaryViewForTable(tableName: string): Promise<{ definition: string } | undefined> {
  const { rows } = await getDb().query<{ definition: string }>(
    'SELECT definition FROM _zenku_views WHERE table_name = ?',
    [tableName]
  );
  if (rows.length === 0) return undefined;
  // Prefer table / master-detail views (same logic as the old ORDER BY CASE)
  const preferred = rows.find(r => {
    try {
      const t = (JSON.parse(r.definition) as { type?: string }).type;
      return t === 'table' || t === 'master-detail';
    } catch { return false; }
  });
  return preferred ?? rows[0];
}
