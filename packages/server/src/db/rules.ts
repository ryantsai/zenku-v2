import { getDb } from './index';

export interface RuleRow {
  id: string;
  name: string;
  description: string | null;
  table_name: string;
  trigger_type: string;
  condition: string | null;
  actions: string;
  priority: number;
  enabled: number;
  created_at: string;
  updated_at: string;
}

export async function getRulesForTable(tableName: string, triggerType?: string): Promise<RuleRow[]> {
  const db = getDb();
  if (triggerType) {
    const { rows } = await db.query<RuleRow>(
      'SELECT * FROM _zenku_rules WHERE table_name = ? AND trigger_type = ? AND enabled = 1 ORDER BY priority ASC',
      [tableName, triggerType]
    );
    return rows;
  }
  const { rows } = await db.query<RuleRow>(
    'SELECT * FROM _zenku_rules WHERE table_name = ? AND enabled = 1 ORDER BY priority ASC',
    [tableName]
  );
  return rows;
}

export async function getAllRules(): Promise<RuleRow[]> {
  const { rows } = await getDb().query<RuleRow>(
    'SELECT * FROM _zenku_rules ORDER BY table_name, priority ASC'
  );
  return rows;
}
