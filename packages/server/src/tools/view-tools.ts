import { getDb, logChange } from '../db';
import type { ViewDefinition, AgentResult } from '../types';

export function createOrUpdateView(view: ViewDefinition, userRequest: string): AgentResult {
  const db = getDb();

  const existing = db.prepare('SELECT id FROM _zenku_views WHERE id = ?').get(view.id);

  if (existing) {
    db.prepare(`
      UPDATE _zenku_views SET name=?, table_name=?, definition=?, updated_at=datetime('now')
      WHERE id=?
    `).run(view.name, view.table_name, JSON.stringify(view), view.id);
    logChange('ui-agent', 'update_view', { viewId: view.id, viewName: view.name }, userRequest);
    return { success: true, message: `已更新介面「${view.name}」`, data: view };
  } else {
    db.prepare(`
      INSERT INTO _zenku_views (id, name, table_name, definition)
      VALUES (?, ?, ?, ?)
    `).run(view.id, view.name, view.table_name, JSON.stringify(view));
    logChange('ui-agent', 'create_view', { viewId: view.id, viewName: view.name }, userRequest);
    return { success: true, message: `已建立介面「${view.name}」`, data: view };
  }
}

export function getAllViewDefinitions(): ViewDefinition[] {
  const db = getDb();
  const rows = db.prepare('SELECT definition FROM _zenku_views ORDER BY created_at').all() as { definition: string }[];
  return rows.map(r => JSON.parse(r.definition) as ViewDefinition);
}
