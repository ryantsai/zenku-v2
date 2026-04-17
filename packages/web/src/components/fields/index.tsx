import type { CSSProperties } from 'react';
import { ComputedField } from './ComputedField';
import { FIELD_REGISTRY } from './registry';
import { Input } from '../ui/input';
import type { FieldDef, FieldType } from '../../types';
import type { AppearanceEffect } from '../../types';
import { cn } from '../../lib/cn';

export type { FieldInputInnerProps, FieldReadonlyProps, FieldEntry } from './registry';
export { FIELD_REGISTRY, TextReadonly } from './registry';

export interface FieldInputProps {
  field: FieldDef;
  value: unknown;
  formValues: Record<string, unknown>;
  onChange: (value: unknown) => void;
  appearance?: AppearanceEffect;
}

export function FieldInput({ field, value, formValues, onChange, appearance }: FieldInputProps) {
  const isDisabled = appearance?.enabled === false;
  const hasWrapper = isDisabled || appearance?.text_color || appearance?.font_weight || appearance?.bg_color;
  const wrapperStyle: CSSProperties = {};
  if (appearance?.text_color)  wrapperStyle.color      = appearance.text_color;
  if (appearance?.font_weight) wrapperStyle.fontWeight = appearance.font_weight;

  // 計算欄位優先（不論 type）
  if (field.computed) {
    const el = <ComputedField field={field} formValues={formValues} onChange={onChange} />;
    return hasWrapper
      ? <AppearanceWrapper style={wrapperStyle} bgColor={appearance?.bg_color} disabled={isDisabled}>{el}</AppearanceWrapper>
      : el;
  }

  const entry = FIELD_REGISTRY[field.type as FieldType];
  if (!entry) {
    return <Input id={field.key} value={String(value ?? '')} disabled />;
  }

  const InputComponent = entry.input;
  const el = (
    <InputComponent
      field={field}
      value={value}
      formValues={formValues}
      onChange={onChange}
      disabled={isDisabled}
    />
  );

  return hasWrapper
    ? <AppearanceWrapper style={wrapperStyle} bgColor={appearance?.bg_color} disabled={isDisabled}>{el}</AppearanceWrapper>
    : el;
}

// ─── Wrapper helper ───────────────────────────────────────────────────────────

interface WrapperProps {
  children: React.ReactNode;
  style?: CSSProperties;
  bgColor?: string;
  disabled?: boolean;
}

function AppearanceWrapper({ children, style, bgColor, disabled }: WrapperProps) {
  return (
    <div
      style={{
        ...style,
        ...(bgColor ? { backgroundColor: bgColor, borderRadius: '6px', padding: '2px' } : {}),
      }}
      className={cn(disabled && 'pointer-events-none opacity-60')}
    >
      {children}
    </div>
  );
}
