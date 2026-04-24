import { evaluateFormula } from '@zenku/shared';
import { getPrimaryViewForTable } from '../db/views';
import { ViewDefinition } from '../types';

export async function recalculateComputedFields(
  tableName: string,
  data: Record<string, any>,
): Promise<Record<string, any>> {
  const viewRow = await getPrimaryViewForTable(tableName);
  if (!viewRow) return data;

  try {
    const viewDef = JSON.parse(viewRow.definition) as ViewDefinition;
    const fields = viewDef.form?.fields || [];
    const computedFields = fields.filter(f => f.computed && f.computed.formula);
    if (computedFields.length === 0) return data;

    const result = { ...data };
    for (const field of computedFields) {
      if (!field.computed) continue;
      try {
        const depValues: Record<string, number> = {};
        const deps = field.computed.dependencies || [];
        for (const dep of deps) {
          const val = result[dep];
          depValues[dep] = val === undefined || val === null ? 0
            : typeof val === 'number' ? val : parseFloat(String(val)) || 0;
        }
        result[field.key] = evaluateFormula(field.computed.formula, depValues);
      } catch (err) {
        console.warn(`[FormulaHandler] Error calculating field "${field.key}" in table "${tableName}":`, err);
      }
    }
    return result;
  } catch (err) {
    console.error('[FormulaHandler] Failed to parse view definition:', err);
    return data;
  }
}
