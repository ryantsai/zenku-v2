import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { cn } from '../../lib/cn';
import type { FieldDef } from '../../types';

interface Option {
  value: string;
  label: string;
}

interface Props {
  field: FieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('zenku-token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function RelationField({ field, value, onChange }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const [displayValue, setDisplayValue] = useState('');
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const { table, value_field, display_field } = field.relation!;

  useEffect(() => {
    if (!value) { setDisplayValue(''); return; }
    const params = new URLSearchParams({ value_field, display_field, id: String(value) });
    fetch(`/api/data/${table}/options?${params}`, { headers: getAuthHeaders() })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data: unknown) => {
        if (Array.isArray(data) && data[0]) setDisplayValue((data[0] as Option).label);
      })
      .catch(() => {});
  }, [value, table, value_field, display_field]);

  useEffect(() => {
    if (!open) { setSearch(''); return; }
    setLoading(true);
    const params = new URLSearchParams({ value_field, display_field });
    fetch(`/api/data/${table}/options?${params}`, { headers: getAuthHeaders() })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data: unknown) => setOptions(Array.isArray(data) ? (data as Option[]) : []))
      .catch(() => setOptions([]))
      .finally(() => {
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 0);
      });
  }, [open, table, value_field, display_field]);

  const filtered = search
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  const handleSelect = (opt: Option) => {
    onChange(opt.value);
    setDisplayValue(opt.label);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={cn('truncate', !displayValue && 'text-muted-foreground')}>
            {displayValue || field.placeholder || t('relation.placeholder')}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <input
            ref={inputRef}
            className="flex h-9 w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
            placeholder={t('relation.search_placeholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="max-h-60 overflow-y-auto py-1">
          {loading ? (
            <div className="py-4 text-center text-sm text-muted-foreground">{t('common.loading')}</div>
          ) : filtered.length === 0 ? (
            <div className="py-4 text-center text-sm text-muted-foreground">{t('relation.no_results')}</div>
          ) : (
            filtered.map(opt => (
              <button
                key={opt.value}
                type="button"
                className={cn(
                  'flex w-full cursor-pointer items-center px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground',
                  String(value) === String(opt.value) && 'bg-accent',
                )}
                onClick={() => handleSelect(opt)}
              >
                <Check
                  className={cn(
                    'mr-2 h-4 w-4 shrink-0',
                    String(value) === String(opt.value) ? 'opacity-100' : 'opacity-0',
                  )}
                />
                {opt.label}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
