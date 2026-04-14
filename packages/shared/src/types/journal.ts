import type { AgentName } from './agent';

export type JournalType = 'schema_change' | 'view_change' | 'rule_change' | 'data_import' | 'file_upload';

export interface JournalEntry {
  id: number;
  timestamp: string;
  session_id: string;
  agent: AgentName;
  type: JournalType;
  description: string;
  diff: { before: unknown; after: unknown };
  reason: string;
  user_request: string;
  reversible: boolean;
  reverse_operations?: string;
  reversed?: boolean;
  reversed_by?: number;
}
