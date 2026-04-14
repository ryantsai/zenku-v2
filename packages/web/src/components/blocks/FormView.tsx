import { useState } from 'react';
import type { FieldDef } from '../../types';

interface Props {
  fields: FieldDef[];
  initialValues?: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}

export function FormView({ fields, initialValues = {}, onSubmit, onCancel }: Props) {
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const init: Record<string, unknown> = {};
    for (const f of fields) {
      init[f.key] = initialValues[f.key] ?? '';
    }
    return init;
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {fields.map(field => (
        <div key={field.key}>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {field.label}
            {field.required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          <FieldInput
            field={field}
            value={values[field.key] ?? ''}
            onChange={v => setValues(prev => ({ ...prev, [field.key]: v }))}
          />
        </div>
      ))}
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
        >
          {submitting ? '儲存中...' : '儲存'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          取消
        </button>
      </div>
    </form>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const baseClass = 'w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent';

  switch (field.type) {
    case 'textarea':
      return (
        <textarea
          className={`${baseClass} min-h-[80px] resize-y`}
          value={String(value ?? '')}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder}
          required={field.required}
        />
      );
    case 'select':
      return (
        <select
          className={baseClass}
          value={String(value ?? '')}
          onChange={e => onChange(e.target.value)}
          required={field.required}
        >
          <option value="">請選擇...</option>
          {field.options?.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    case 'boolean':
      return (
        <input
          type="checkbox"
          className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
          checked={Boolean(value)}
          onChange={e => onChange(e.target.checked)}
        />
      );
    case 'number':
      return (
        <input
          type="number"
          className={baseClass}
          value={String(value ?? '')}
          onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          placeholder={field.placeholder}
          required={field.required}
        />
      );
    case 'date':
      return (
        <input
          type="date"
          className={baseClass}
          value={String(value ?? '')}
          onChange={e => onChange(e.target.value)}
          required={field.required}
        />
      );
    default:
      return (
        <input
          type="text"
          className={baseClass}
          value={String(value ?? '')}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder}
          required={field.required}
        />
      );
  }
}
