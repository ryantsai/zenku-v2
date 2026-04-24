import { getDb } from './index';

export interface WebhookLogEntry {
  rule_id?: string;
  rule_name: string;
  table_name: string;
  record_id?: string;
  trigger_type: string;
  url: string;
  method: string;
  http_status?: number;
  duration_ms?: number;
  status: 'success' | 'failed';
  error?: string;
}

export async function writeWebhookLog(entry: WebhookLogEntry): Promise<void> {
  const db = getDb();
  await db.execute(`
    INSERT INTO _zenku_webhook_logs
      (rule_id, rule_name, table_name, record_id, trigger_type, url, method, http_status, duration_ms, status, error)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    entry.rule_id ?? null,
    entry.rule_name,
    entry.table_name,
    entry.record_id ?? null,
    entry.trigger_type,
    entry.url,
    entry.method,
    entry.http_status ?? null,
    entry.duration_ms ?? null,
    entry.status,
    entry.error ?? null,
  ]);
  // Keep only the 1000 most recent rows
  await db.execute(`
    DELETE FROM _zenku_webhook_logs WHERE id NOT IN (
      SELECT id FROM _zenku_webhook_logs ORDER BY id DESC LIMIT 1000
    )
  `);
}
