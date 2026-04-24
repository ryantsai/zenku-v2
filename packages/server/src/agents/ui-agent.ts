import { getDb } from '../db';
import { createOrUpdateView } from '../tools/view-tools';
import type { ViewDefinition, AgentResult } from '../types';

interface UiInput {
  action: 'create_view' | 'update_view' | 'get_view' | 'delete_view';
  view?: ViewDefinition;
  view_id?: string;
}

export async function runUiAgent(input: UiInput, userRequest: string): Promise<AgentResult> {
  // Claude sometimes serializes objects/arrays as JSON strings — parse them back
  if (typeof input.view === 'string') {
    try { input.view = JSON.parse(input.view); } catch { /* leave as-is */ }
  }

  if (input.action === 'get_view') {
    const id = input.view_id;
    if (!id) return { success: false, message: 'get_view requires view_id' };
    const { rows } = await getDb().query<{ definition: string }>(
      'SELECT definition FROM _zenku_views WHERE id = ?', [id]
    );
    if (!rows[0]) return { success: false, message: `View "${id}" not found` };
    return { success: true, message: `View definition for "${id}"`, data: JSON.parse(rows[0].definition) as ViewDefinition };
  }

  if (input.action === 'delete_view') {
    const id = input.view_id;
    if (!id) return { success: false, message: 'delete_view requires view_id' };
    const result = await getDb().execute('DELETE FROM _zenku_views WHERE id = ?', [id]);
    if (result.rowsAffected === 0) return { success: false, message: `View "${id}" not found` };
    return { success: true, message: `View "${id}" deleted` };
  }

  if (!input.view) return { success: false, message: 'create_view / update_view requires view' };
  return createOrUpdateView(input.view, userRequest);
}
