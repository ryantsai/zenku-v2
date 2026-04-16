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
export function evaluateAppearanceCondition(
  condition: AppearanceCondition,
  record: Record<string, unknown>,
): boolean {
  // 複合條件
  if ('logic' in condition) {
    const results = condition.conditions.map(c => evaluateAppearanceCondition(c, record));
    return condition.logic === 'and' ? results.every(Boolean) : results.some(Boolean);
  }

  // 葉節點
  const { field, operator, value } = condition;
  const fieldVal = record[field];

  switch (operator) {
    case 'eq':
      return String(fieldVal ?? '') === String(value ?? '');
    case 'neq':
      return String(fieldVal ?? '') !== String(value ?? '');
    case 'gt':
      return Number(fieldVal) > Number(value);
    case 'lt':
      return Number(fieldVal) < Number(value);
    case 'gte':
      return Number(fieldVal) >= Number(value);
    case 'lte':
      return Number(fieldVal) <= Number(value);
    case 'contains':
      return String(fieldVal ?? '').toLowerCase().includes(String(value ?? '').toLowerCase());
    default:
      return false;
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
