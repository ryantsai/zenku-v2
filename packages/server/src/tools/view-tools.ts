import { getDb, dbNow } from '../db';
import { logChange } from '../db/changes';
import { writeJournal } from '../db/journal';
import type { ViewDefinition, AgentResult } from '../types';

const WIDGET_TYPE_SUFFIX = /\s*\((Pie|Line|Bar|Area|Chart|Stat|Card|Table|Trend)\)\s*$/i;

function removeUndefined(obj: any): any {
  if (obj === null || obj === undefined) return undefined;
  if (Array.isArray(obj)) return obj.map(removeUndefined).filter(x => x !== undefined);
  if (typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const cleaned = removeUndefined(value);
      if (cleaned !== undefined) {
        result[key] = cleaned;
      }
    }
    return result;
  }
  return obj;
}

function sanitizeView(view: ViewDefinition): ViewDefinition {
  // Remove undefined values first
  let sanitized = removeUndefined(view) as ViewDefinition;

  if (!sanitized.widgets?.length) return sanitized;
  return {
    ...sanitized,
    widgets: sanitized.widgets.map(w => ({
      ...w,
      title: w.title.replace(WIDGET_TYPE_SUFFIX, '').trim(),
    })),
  };
}

export async function createOrUpdateView(view: ViewDefinition, userRequest: string): Promise<AgentResult> {
  view = sanitizeView(view);

  if (!view.id) return { success: false, message: 'view.id is required' };
  if (!view.name) return { success: false, message: 'view.name is required' };
  if (!view.table_name) return { success: false, message: 'view.table_name is required' };

  const db = getDb();

  const { rows: existing } = await db.query(
    'SELECT id FROM _zenku_views WHERE id = ?',
    [view.id]
  );

  if (existing.length > 0) {
    const { rows: oldRows } = await db.query<{ definition: string }>(
      'SELECT definition FROM _zenku_views WHERE id = ?',
      [view.id]
    );
    const oldDef = oldRows[0] ? JSON.parse(oldRows[0].definition) : null;

    await db.execute(`
      UPDATE _zenku_views SET name=?, table_name=?, definition=?, updated_at=?
      WHERE id=?
    `, [view.name ?? '', view.table_name ?? '', JSON.stringify(view), dbNow(), view.id ?? '']);
    await logChange('ui-agent', 'update_view', { viewId: view.id, viewName: view.name }, userRequest);

    await writeJournal({
      agent: 'ui',
      type: 'view_change',
      description: `Updated interface "${view.name}"`,
      diff: { before: oldDef, after: view },
      user_request: userRequest,
      reversible: true,
      reverse_operations: oldDef ? [{
        type: 'sql',
        sql: `UPDATE _zenku_views SET name=${JSON.stringify(oldDef.name)}, table_name=${JSON.stringify(oldDef.table_name)}, definition=${JSON.stringify(JSON.stringify(oldDef))} WHERE id=${JSON.stringify(view.id)}`,
      }] : [{ type: 'sql', sql: `DELETE FROM _zenku_views WHERE id = ${JSON.stringify(view.id)}` }],
    });

    return { success: true, message: `Updated interface "${view.name}"`, data: view };
  } else {
    await db.execute(`
      INSERT INTO _zenku_views (id, name, table_name, definition)
      VALUES (?, ?, ?, ?)
    `, [view.id ?? '', view.name ?? '', view.table_name ?? '', JSON.stringify(view)]);
    await logChange('ui-agent', 'create_view', { viewId: view.id, viewName: view.name }, userRequest);

    await writeJournal({
      agent: 'ui',
      type: 'view_change',
      description: `Created interface "${view.name}"`,
      diff: { before: null, after: view },
      user_request: userRequest,
      reversible: true,
      reverse_operations: [{ type: 'sql', sql: `DELETE FROM _zenku_views WHERE id = ${JSON.stringify(view.id)}` }],
    });

    return { success: true, message: `Created interface "${view.name}"`, data: view };
  }
}

export async function getAllViewDefinitions(): Promise<ViewDefinition[]> {
  const { rows } = await getDb().query<{ definition: string }>(
    'SELECT definition FROM _zenku_views ORDER BY created_at'
  );
  return rows.map(r => JSON.parse(r.definition) as ViewDefinition);
}
