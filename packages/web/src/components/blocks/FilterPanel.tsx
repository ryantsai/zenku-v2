import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import type { ColumnDef } from '../../types';
import type { Filter, FilterOperator } from '@zenku/shared';

interface Props {
  columns: ColumnDef[];
  filters: Filter[];
  onChange: (filters: Filter[]) => void;
}

type FieldType = ColumnDef['type'];

const OPERATORS_BY_TYPE: Record<string, { value: FilterOperator; label: string }[]> = {
  text: [
    { value: 'contains',     label: '包含' },
    { value: 'not_contains', label: '不包含' },
    { value: 'eq',           label: '等於' },
    { value: 'neq',          label: '不等於' },
    { value: 'is_empty',     label: '為空' },
    { value: 'is_not_empty', label: '不為空' },
  ],
  textarea: [
    { value: 'contains',     label: '包含' },
    { value: 'not_contains', label: '不包含' },
    { value: 'is_empty',     label: '為空' },
    { value: 'is_not_empty', label: '不為空' },
  ],
  number: [
    { value: 'eq',           label: '等於' },
    { value: 'neq',          label: '不等於' },
    { value: 'gt',           label: '大於' },
    { value: 'gte',          label: '大於等於' },
    { value: 'lt',           label: '小於' },
    { value: 'lte',          label: '小於等於' },
    { value: 'is_empty',     label: '為空' },
    { value: 'is_not_empty', label: '不為空' },
  ],
  currency: [
    { value: 'eq',           label: '等於' },
    { value: 'neq',          label: '不等於' },
    { value: 'gt',           label: '大於' },
    { value: 'gte',          label: '大於等於' },
    { value: 'lt',           label: '小於' },
    { value: 'lte',          label: '小於等於' },
    { value: 'is_empty',     label: '為空' },
    { value: 'is_not_empty', label: '不為空' },
  ],
  date: [
    { value: 'eq',           label: '等於' },
    { value: 'neq',          label: '不等於' },
    { value: 'gt',           label: '晚於' },
    { value: 'gte',          label: '晚於等於' },
    { value: 'lt',           label: '早於' },
    { value: 'lte',          label: '早於等於' },
    { value: 'is_empty',     label: '為空' },
    { value: 'is_not_empty', label: '不為空' },
  ],
  datetime: [
    { value: 'eq',           label: '等於' },
    { value: 'neq',          label: '不等於' },
    { value: 'gt',           label: '晚於' },
    { value: 'gte',          label: '晚於等於' },
    { value: 'lt',           label: '早於' },
    { value: 'lte',          label: '早於等於' },
    { value: 'is_empty',     label: '為空' },
    { value: 'is_not_empty', label: '不為空' },
  ],
  boolean: [
    { value: 'eq',  label: '等於' },
    { value: 'neq', label: '不等於' },
  ],
  select: [
    { value: 'eq',           label: '等於' },
    { value: 'neq',          label: '不等於' },
    { value: 'is_empty',     label: '為空' },
    { value: 'is_not_empty', label: '不為空' },
  ],
};

function getOperators(type: FieldType) {
  return OPERATORS_BY_TYPE[type] ?? OPERATORS_BY_TYPE['text'];
}

function needsValue(op: FilterOperator): boolean {
  return op !== 'is_empty' && op !== 'is_not_empty';
}

function defaultOperator(type: FieldType): FilterOperator {
  const ops = getOperators(type);
  return ops[0]?.value ?? 'eq';
}

export function FilterPanel({ columns, filters, onChange }: Props) {
  const filterableColumns = columns.filter(c => !c.hidden_in_table);

  const addFilter = () => {
    const firstCol = filterableColumns[0];
    if (!firstCol) return;
    onChange([...filters, { field: firstCol.key, operator: defaultOperator(firstCol.type), value: '' }]);
  };

  const removeFilter = (index: number) => {
    onChange(filters.filter((_, i) => i !== index));
  };

  const updateFilter = (index: number, patch: Partial<Filter>) => {
    onChange(filters.map((f, i) => {
      if (i !== index) return f;
      const updated = { ...f, ...patch };
      // If operator changed to one that needs no value, reset value
      if (patch.operator && !needsValue(patch.operator)) updated.value = '';
      // If field changed, reset operator and value
      if (patch.field) {
        const newCol = filterableColumns.find(c => c.key === patch.field);
        updated.operator = newCol ? defaultOperator(newCol.type) : 'eq';
        updated.value = '';
      }
      return updated;
    }));
  };

  if (filters.length === 0) {
    return (
      <div className="flex items-center gap-3 border-b bg-muted/30 px-6 py-2">
        <span className="text-xs text-muted-foreground">無篩選條件</span>
        <Button variant="ghost" size="sm" onClick={addFilter} disabled={filterableColumns.length === 0}>
          <Plus className="mr-1 h-3.5 w-3.5" />加入條件
        </Button>
      </div>
    );
  }

  return (
    <div className="border-b bg-muted/30 px-6 py-3 space-y-2">
      {filters.map((f, i) => {
        const col = filterableColumns.find(c => c.key === f.field) ?? filterableColumns[0];
        const operators = col ? getOperators(col.type) : OPERATORS_BY_TYPE['text'];
        const showValue = needsValue(f.operator);

        return (
          <div key={i} className="flex items-center gap-2">
            {/* Field */}
            <Select value={f.field} onValueChange={v => updateFilter(i, { field: v })}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {filterableColumns.map(c => (
                  <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Operator */}
            <Select value={f.operator} onValueChange={v => updateFilter(i, { operator: v as FilterOperator })}>
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {operators.map(op => (
                  <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Value */}
            {showValue ? (
              <Input
                className="h-8 text-xs w-40"
                placeholder="輸入值..."
                value={String(f.value ?? '')}
                onChange={e => updateFilter(i, { value: e.target.value })}
              />
            ) : (
              <div className="w-40" />
            )}

            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeFilter(i)}>
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </div>
        );
      })}

      <div className="flex items-center gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={addFilter}>
          <Plus className="mr-1 h-3.5 w-3.5" />加入條件
        </Button>
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => onChange([])}>
          清除全部
        </Button>
      </div>
    </div>
  );
}
