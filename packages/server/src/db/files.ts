import { getDb } from './index';

export interface FileRecord {
  id: string;
  filename: string;
  mime_type: string;
  size: number;
  path: string;
  table_name: string | null;
  record_id: string | null;
  field_name: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export async function insertFile(meta: Omit<FileRecord, 'created_at'>): Promise<FileRecord> {
  await getDb().execute(`
    INSERT INTO _zenku_files (id, filename, mime_type, size, path, table_name, record_id, field_name, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    meta.id, meta.filename, meta.mime_type, meta.size, meta.path,
    meta.table_name ?? null, meta.record_id ?? null,
    meta.field_name ?? null, meta.uploaded_by ?? null,
  ]);
  return (await getFile(meta.id))!;
}

export async function getFile(id: string): Promise<FileRecord | null> {
  const { rows } = await getDb().query<FileRecord>(
    'SELECT * FROM _zenku_files WHERE id = ?',
    [id]
  );
  return rows[0] ?? null;
}

export async function listFilesByIds(ids: string[]): Promise<FileRecord[]> {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => '?').join(',');
  const { rows } = await getDb().query<FileRecord>(
    `SELECT * FROM _zenku_files WHERE id IN (${placeholders})`,
    ids
  );
  return rows;
}

export async function deleteFileRecord(id: string): Promise<void> {
  await getDb().execute('DELETE FROM _zenku_files WHERE id = ?', [id]);
}
