import type { AIProvider, TokenUsage } from './ai-provider';
import type { AgentName } from './agent';

// ===== Chat Session =====

export interface ChatSession {
  id: string;
  user_id: string;
  title: string;
  provider: AIProvider;
  model: string;
  created_at: string;
  updated_at: string;
  total_input_tokens: number;
  total_output_tokens: number;
  total_thinking_tokens: number;
  total_cost_usd: number;
  message_count: number;
}

// ===== Individual Message =====

export interface ChatMessageRecord {
  id: string;
  session_id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;

  provider?: AIProvider;
  model?: string;
  usage?: TokenUsage;
  latency_ms?: number;
  /** Raw chain-of-thought content */
  thinking?: string;

  tool_events?: ToolEventRecord[];
}

// ===== Tool Usage Records =====

export interface ToolEventRecord {
  id: string;
  message_id: string;
  session_id: string;
  agent: AgentName;
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_output: {
    success: boolean;
    message: string;
    data?: unknown;
  };
  started_at: string;
  finished_at: string;
  latency_ms: number;
}

// ===== Admin Usage Statistics =====

export interface UsageStats {
  period: string;
  total_sessions: number;
  total_messages: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost_usd: number;
  by_provider: Record<string, {
    sessions: number;
    messages: number;
    tokens: number;
    cost_usd: number;
  }>;
  by_user: Record<string, {
    sessions: number;
    messages: number;
    tokens: number;
    cost_usd: number;
  }>;
  by_agent: Record<string, {
    calls: number;
    avg_latency_ms: number;
    error_count: number;
  }>;
}

// ===== SSE Stream =====

export type SSEChunk =
  | { type: 'text'; content: string }
  | { type: 'thinking'; content: string }
  | { type: 'tool_start'; tool: string; agent: AgentName }
  | { type: 'tool_result'; tool: string; agent: AgentName; result: { success: boolean; message: string; data?: unknown } }
  | { type: 'usage'; usage: TokenUsage; latency_ms: number }
  | { type: 'done'; session_id?: string | null }
  | { type: 'error'; message: string };

// ===== Frontend chat message (includes UI state) =====

export interface ChatMessageAttachment {
  filename: string;
  mime_type: string;
  /** Object URL for local preview (only present in current session) */
  previewUrl?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolEvents?: ToolEvent[];
  attachments?: ChatMessageAttachment[];
}

export interface ToolEvent {
  type: 'tool_start' | 'tool_result';
  tool: string;
  result?: { success: boolean; message: string; data?: unknown };
}
