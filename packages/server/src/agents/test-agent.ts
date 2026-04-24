import { getDb } from '../db';
import { getAllViews } from '../db/views';
import { getAllRules } from '../db/rules';
import type { AgentResult } from '../types';

interface AssessInput {
  table_name: string;
  change_type: 'drop_column' | 'rename_column' | 'change_type' | 'drop_table';
  details?: { column_name?: string; new_name?: string; new_type?: string };
}

export async function runTestAgent(input: AssessInput): Promise<AgentResult> {
  const { table_name, change_type, details } = input;
  const db = getDb();

  const [allViews, allRulesData] = await Promise.all([getAllViews(), getAllRules()]);

  const affectedViews = allViews.filter(v => {
    try {
      const def = JSON.parse(v.definition);
      if (def.table_name === table_name) return true;
      if (def.detail_views?.some((d: { table_name: string }) => d.table_name === table_name)) return true;
      return false;
    } catch { return false; }
  });

  const affectedRules = allRulesData.filter(r => r.table_name === table_name);

  let rowCount = 0;
  try {
    const { rows } = await db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM "${table_name}"`
    );
    rowCount = rows[0]?.count ?? 0;
  } catch { /* table might not exist */ }

  // Find referencing foreign keys
  const allTables = await db.listTables();
  const otherTables = allTables.filter(t => t !== table_name);

  const referencingTables: string[] = [];
  for (const t of otherTables) {
    const { rows: fkList } = await db.query<{ table: string; from: string }>(
      `PRAGMA foreign_key_list("${t}")`
    );
    if (fkList.some(fk => fk.table === table_name)) referencingTables.push(t);
  }

  const impacts: string[] = [];

  if (change_type === 'drop_table') {
    impacts.push(`Will delete table ${table_name} and ${rowCount} records`);
    if (referencingTables.length > 0)
      impacts.push(`Following tables have foreign key dependencies: ${referencingTables.join(', ')}, may cause orphaned data or deletion failure`);
    if (affectedViews.length > 0)
      impacts.push(`${affectedViews.length} interfaces will fail: ${affectedViews.map(v => v.name).join(', ')}`);
    if (affectedRules.length > 0)
      impacts.push(`${affectedRules.length} rules will fail: ${affectedRules.map(r => r.name).join(', ')}`);
  } else if (change_type === 'drop_column' && details?.column_name) {
    impacts.push(`Will delete field ${details.column_name}, ${rowCount} records will lose values in this field`);
    for (const v of affectedViews) {
      try {
        const def = JSON.parse(v.definition);
        const cols = def.columns ?? [];
        const formFields = def.form?.fields ?? [];
        if (cols.some((c: { key: string }) => c.key === details.column_name) ||
            formFields.some((f: { key: string }) => f.key === details.column_name)) {
          impacts.push(`Interface "${v.name}" uses this field, needs sync update`);
        }
      } catch { /* skip */ }
    }
    for (const r of affectedRules) {
      const cond = r.condition ? JSON.parse(r.condition) : null;
      const acts = JSON.parse(r.actions) as { field?: string }[];
      if (cond?.field === details.column_name || acts.some(a => a.field === details.column_name))
        impacts.push(`Rule "${r.name}" references this field, needs sync update`);
    }
  } else if (change_type === 'rename_column' && details?.column_name) {
    impacts.push(`Will rename field ${details.column_name} to ${details.new_name ?? '?'}, needs sync updating all references`);
  } else if (change_type === 'change_type' && details?.column_name) {
    impacts.push(`Will change type of field ${details.column_name} to ${details.new_type ?? '?'}, may cause ${rowCount} records type conversion issues`);
  }

  const severity = rowCount > 100 || referencingTables.length > 0 ? 'HIGH_RISK' : 'MEDIUM_RISK';
  const report = `⚠️ Change Impact Assessment (${severity}):\n- Affected records: ${rowCount}\n- Affected interfaces: ${affectedViews.length}\n- Affected rules: ${affectedRules.length}\n${referencingTables.length > 0 ? `- Foreign key dependent tables: ${referencingTables.join(', ')}` : ''}\n\n${impacts.length > 0 ? `Details:\n${impacts.map(i => `• ${i}`).join('\n')}` : ''}\n\nRecommendation: ${rowCount > 100 ? 'Proceed carefully, recommend backing up data first' : 'Record volume is small, can proceed'}. Continue?`;

  return {
    success: true,
    message: report,
    data: { severity, affected_views: affectedViews.length, affected_rules: affectedRules.length, affected_rows: rowCount, referencing_tables: referencingTables, impacts },
  };
}
