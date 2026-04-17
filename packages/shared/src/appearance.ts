/**
 * Conditional Appearance — Client-side 條件求值
 * 在 Client 端即時求值，不需要 server round-trip
 */

import type { AppearanceCondition, AppearanceEffect, AppearanceRule } from './types/appearance';

/**
 * 對一個 AppearanceCondition 求值
 * @param condition 條件（可為複合 AND/OR 或單一葉節點）
 * @param record    目前的表單值或列資料
 */
/**
 * Resolve dynamic value tokens in appearance conditions.
 * Supported tokens: 'TODAY' → current date as 'YYYY-MM-DD'
 */
function resolveValue(raw: unknown): unknown {
  if (raw === 'TODAY') return new Date().toISOString().slice(0, 10); // e.g. '2025-04-17'
  return raw;
}

/** Return true if the value looks like an ISO date string (YYYY-MM-DD) */
function isDateString(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v);
}

export function evaluateAppearanceCondition(
  condition: AppearanceCondition,
  record: Record<string, unknown>,
): boolean {
  // Compound condition
  if ('logic' in condition) {
    const results = condition.conditions.map(c => evaluateAppearanceCondition(c, record));
    return condition.logic === 'and' ? results.every(Boolean) : results.some(Boolean);
  }

  // Leaf node
  const { field, operator } = condition;
  const fieldVal = record[field];
  const value = resolveValue(condition.value);

  // Use string comparison for date fields; numeric otherwise
  const dateMode = isDateString(fieldVal) || isDateString(value);

  const compare = (): number => {
    if (dateMode) {
      const a = String(fieldVal ?? '');
      const b = String(value ?? '');
      return a < b ? -1 : a > b ? 1 : 0;
    }
    return Number(fieldVal) - Number(value);
  };

  switch (operator) {
    case 'eq':       return String(fieldVal ?? '') === String(value ?? '');
    case 'neq':      return String(fieldVal ?? '') !== String(value ?? '');
    case 'gt':       return compare() > 0;
    case 'lt':       return compare() < 0;
    case 'gte':      return compare() >= 0;
    case 'lte':      return compare() <= 0;
    case 'contains': return String(fieldVal ?? '').toLowerCase().includes(String(value ?? '').toLowerCase());
    default:         return false;
  }
}

/**
 * 將一組 AppearanceRule 對指定資料求值，合併出最終效果
 * 陣列後面的規則可覆蓋前面的規則（後規則優先）
 */
export function resolveAppearance(
  rules: AppearanceRule[],
  record: Record<string, unknown>,
): AppearanceEffect {
  let effect: AppearanceEffect = {};
  for (const rule of rules) {
    if (rule.enabled === false) continue;  // 跳過停用的規則
    if (evaluateAppearanceCondition(rule.when, record)) {
      effect = { ...effect, ...rule.apply };
    }
  }
  return effect;
}
