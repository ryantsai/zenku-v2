import { getPrimaryViewForTable } from '../db/views';
import { getDb } from '../db';
import type { AutoNumberConfig } from '@zenku/shared';

function getPeriodKey(cfg: AutoNumberConfig): string {
  const reset = cfg.reset ?? 'never';
  if (reset === 'never') return '';

  const now = new Date();
  const yyyy = now.getFullYear().toString();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');

  if (reset === 'yearly')  return yyyy;
  if (reset === 'monthly') return `${yyyy}-${mm}`;
  return `${yyyy}-${mm}-${dd}`;
}

function getDateSegment(cfg: AutoNumberConfig): string {
  if (!cfg.date_format) return '';

  const now = new Date();
  const yyyy = now.getFullYear().toString();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');

  if (cfg.date_format === 'YYYY')     return yyyy;
  if (cfg.date_format === 'YYYYMM')   return `${yyyy}${mm}`;
  return `${yyyy}${mm}${dd}`;
}

async function incrementCounter(tableName: string, fieldName: string, period: string): Promise<number> {
  return getDb().upsertCounter(tableName, fieldName, period);
}

function formatValue(seq: number, cfg: AutoNumberConfig): string {
  const padding = cfg.padding ?? 4;
  return `${cfg.prefix ?? ''}${getDateSegment(cfg)}${String(seq).padStart(padding, '0')}`;
}

interface AutoNumberField {
  key: string;
  cfg: AutoNumberConfig;
}

async function getAutoNumberFields(tableName: string): Promise<AutoNumberField[]> {
  const viewRow = await getPrimaryViewForTable(tableName);
  if (!viewRow) return [];

  try {
    const viewDef = JSON.parse(viewRow.definition) as {
      form?: { fields?: { key: string; type: string; auto_number?: AutoNumberConfig }[] }
    };
    return (viewDef.form?.fields ?? [])
      .filter(f => f.type === 'auto_number' && f.auto_number)
      .map(f => ({ key: f.key, cfg: f.auto_number! }));
  } catch {
    return [];
  }
}

export async function applyAutoNumbers(
  tableName: string,
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const fields = await getAutoNumberFields(tableName);
  if (fields.length === 0) return data;

  const result = { ...data };
  for (const { key, cfg } of fields) {
    result[key] = formatValue(await incrementCounter(tableName, key, getPeriodKey(cfg)), cfg);
  }
  return result;
}
