export type TriggerType =
  | 'before_insert' | 'after_insert'
  | 'before_update' | 'after_update'
  | 'before_delete'
  | 'on_schedule' | 'manual';

export interface Rule {
  id: string;
  name: string;
  description: string;
  table_name: string;
  trigger_type: TriggerType;
  enabled: boolean;
  priority?: number;

  condition?: RuleCondition;
  actions: RuleAction[];
}

export interface RuleCondition {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'contains' | 'changed';
  value?: unknown;
}

export type RuleAction =
  | { type: 'set_field'; field: string; value: string }
  | { type: 'validate'; field: string; rule: string; message: string }
  | { type: 'webhook'; url: string; method: 'GET' | 'POST'; payload?: string }
  | { type: 'create_record'; table: string; data: Record<string, string> }
  | { type: 'notify'; channel: 'log' | 'webhook'; message: string };
