import { useEffect, useRef } from 'react';
import { Input } from '../ui/input';
import { evaluateFormula } from '@zenku/shared';
import type { FieldDef } from '../../types';

interface Props {
  field: FieldDef;
  formValues: Record<string, unknown>;
  onChange: (value: unknown) => void;
}

function formatValue(value: number, format?: string): string {
  if (!isFinite(value)) return '';
  switch (format) {
    case 'currency':
      return `$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    case 'percent':
      return `${(value * 100).toFixed(1)}%`;
    default:
      return value % 1 === 0 ? String(value) : value.toFixed(2);
  }
}

export function ComputedField({ field, formValues, onChange }: Props) {
  const computed = field.computed!;
  // Use a ref to track onChange and avoid adding it as an effect dependency
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Serialize dependency values to a string so the effect only re-runs when values actually change
  const depValuesKey = computed.dependencies
    .map(d => String(formValues[d] ?? ''))
    .join('|');

  useEffect(() => {
    try {
      const depValues: Record<string, number> = {};
      for (const dep of computed.dependencies) {
        depValues[dep] = Number(formValues[dep]) || 0;
      }
      const result = evaluateFormula(computed.formula, depValues);
      onChangeRef.current(result);
    } catch {
      // Do not update on formula error
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depValuesKey, computed.formula]);

  // Calculate display value
  let displayValue = '';
  try {
    const depValues: Record<string, number> = {};
    for (const dep of computed.dependencies) {
      depValues[dep] = Number(formValues[dep]) || 0;
    }
    const result = evaluateFormula(computed.formula, depValues);
    displayValue = formatValue(result, computed.format);
  } catch {
    displayValue = '';
  }

  return (
    <Input
      value={displayValue}
      disabled
      className="bg-muted/50 text-muted-foreground"
      placeholder="Auto-calculated"
    />
  );
}
