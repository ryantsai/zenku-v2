/**
 * Conditional Appearance — 條件外觀型別定義
 * 讓 UI 元件依據表單/列資料的即時狀態動態改變呈現方式
 */

// ===== 條件 =====

/** 葉節點條件（單一欄位判斷） */
export interface LeafCondition {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains';
  value?: unknown;
}

/** 複合條件（AND / OR 組合），或單一葉節點 */
export type AppearanceCondition =
  | { logic: 'and'; conditions: AppearanceCondition[] }
  | { logic: 'or';  conditions: AppearanceCondition[] }
  | LeafCondition;

// ===== 效果 =====

export interface AppearanceEffect {
  /** 隱藏或顯示欄位 */
  visibility?: 'hidden' | 'visible';
  /** false = 欄位停用（唯讀） */
  enabled?: boolean;
  /** true = 欄位在此條件下為必填 */
  required?: boolean;
  /** 文字顏色（CSS color，如 "#dc2626"） */
  text_color?: string;
  /** 背景色（CSS color） */
  bg_color?: string;
  /** 字體粗細 */
  font_weight?: 'normal' | 'bold';
}

// ===== 規則 =====

export interface AppearanceRule {
  /** 觸發條件 */
  when: AppearanceCondition;
  /** 條件成立時套用的效果 */
  apply: AppearanceEffect;
  /** false = 此規則停用（不求值），預設 true */
  enabled?: boolean;
}
