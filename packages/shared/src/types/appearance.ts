/**
 * Conditional Appearance — type definitions for conditional appearance rules
 * Allows UI components to dynamically change their presentation based on real-time form/row data
 */

// ===== Conditions =====

/** Leaf condition (single field evaluation) */
export interface LeafCondition {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains';
  value?: unknown;
}

/** Compound condition (AND / OR combination), or a single leaf node */
export type AppearanceCondition =
  | { logic: 'and'; conditions: AppearanceCondition[] }
  | { logic: 'or';  conditions: AppearanceCondition[] }
  | LeafCondition;

// ===== Effects =====

export interface AppearanceEffect {
  /** Hide or show the field */
  visibility?: 'hidden' | 'visible';
  /** false = field is disabled (read-only) */
  enabled?: boolean;
  /** true = field is required when this condition is met */
  required?: boolean;
  /** Text color (CSS color, e.g. "#dc2626") */
  text_color?: string;
  /** Background color (CSS color) */
  bg_color?: string;
  /** Font weight */
  font_weight?: 'normal' | 'bold';
}

// ===== Rules =====

export interface AppearanceRule {
  /** Trigger condition */
  when: AppearanceCondition;
  /** Effect to apply when the condition is true */
  apply: AppearanceEffect;
  /** false = this rule is disabled (not evaluated); default true */
  enabled?: boolean;
}
