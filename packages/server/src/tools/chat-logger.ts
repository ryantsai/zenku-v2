import { getDb } from '../db';
import { estimateCost } from '../types';
import type { TokenUsage } from '../types';

type AgentName = 'orchestrator' | 'schema' | 'ui' | 'query' | 'logic' | 'test';

export function toolToAgent(toolName: string): AgentName {
  switch (toolName) {
    case 'manage_schema': return 'schema';
    case 'manage_ui':     return 'ui';
    case 'query_data':    return 'query';
    case 'manage_rules':  return 'logic';
    case 'assess_impact': return 'test';
    default:              return 'orchestrator';
  }
}

// ── Session ──────────────────────────────────────────────────────────────────

export function createChatSession(userId: string, provider: string, model: string, title?: string): string {
  const db = getDb();
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO _zenku_chat_sessions (id, user_id, provider, model, title)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, userId, provider, model, title ?? null);
  return id;
}

export function updateSessionTitle(sessionId: string, title: string): void {
  getDb().prepare(
    `UPDATE _zenku_chat_sessions SET title = ? WHERE id = ? AND title IS NULL`
  ).run(title, sessionId);
}

export function updateSessionStats(sessionId: string, usage: TokenUsage, model: string): void {
  const cost = estimateCost(model, usage);
  getDb().prepare(`
    UPDATE _zenku_chat_sessions SET
      total_input_tokens   = total_input_tokens + ?,
      total_output_tokens  = total_output_tokens + ?,
      total_thinking_tokens = total_thinking_tokens + ?,
      total_cost_usd       = total_cost_usd + ?,
      message_count        = message_count + 1,
      updated_at           = datetime('now')
    WHERE id = ?
  `).run(
    usage.input_tokens,
    usage.output_tokens,
    usage.thinking_tokens ?? 0,
    cost,
    sessionId,
  );
}

// ── Messages ──────────────────────────────────────────────────────────────────

export interface RecordMessageInput {
  session_id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  provider?: string;
  model?: string;
  input_tokens?: number;
  output_tokens?: number;
  thinking_tokens?: number;
  thinking_content?: string;
  latency_ms?: number;
}

export function recordMessage(input: RecordMessageInput): string {
  const db = getDb();
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO _zenku_chat_messages
    (id, session_id, user_id, role, content, provider, model,
     input_tokens, output_tokens, thinking_tokens, thinking_content, latency_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.session_id,
    input.user_id,
    input.role,
    input.content,
    input.provider ?? null,
    input.model ?? null,
    input.input_tokens ?? 0,
    input.output_tokens ?? 0,
    input.thinking_tokens ?? 0,
    input.thinking_content ?? null,
    input.latency_ms ?? 0,
  );
  return id;
}

// ── Tool events ───────────────────────────────────────────────────────────────

export interface RecordToolEventInput {
  message_id: string;
  session_id: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_output: { success: boolean; message: string; data?: unknown };
  started_at: string;
  finished_at: string;
  latency_ms: number;
}

export function recordToolEvent(input: RecordToolEventInput): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO _zenku_tool_events
    (id, message_id, session_id, agent, tool_name, tool_input, tool_output, success, started_at, finished_at, latency_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    input.message_id,
    input.session_id,
    toolToAgent(input.tool_name),
    input.tool_name,
    JSON.stringify(input.tool_input),
    JSON.stringify(input.tool_output),
    input.tool_output.success ? 1 : 0,
    input.started_at,
    input.finished_at,
    input.latency_ms,
  );
}
