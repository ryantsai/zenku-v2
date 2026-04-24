import { getDb } from './index';

export async function logChange(
  agent: string,
  action: string,
  detail: unknown,
  userRequest: string,
): Promise<void> {
  await getDb().execute(`
    INSERT INTO _zenku_changes (agent, action, detail, user_request)
    VALUES (?, ?, ?, ?)
  `, [agent, action, JSON.stringify(detail), userRequest ?? '']);
}
