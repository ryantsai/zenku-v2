import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { getTableData, updateRow } from '../../api';
import type { ViewDefinition } from '../../types';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { FormView } from './FormView';

interface Props {
  view: ViewDefinition;
}

type RowData = Record<string, unknown>;

const AUTO_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444',
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6',
];

function resolveColor(value: unknown, colorMap: Map<string, string>): string {
  if (!value) return '#6366f1';
  const str = String(value);
  if (/^#[0-9a-fA-F]{3,8}$/.test(str)) return str;
  if (!colorMap.has(str)) {
    colorMap.set(str, AUTO_COLORS[colorMap.size % AUTO_COLORS.length]);
  }
  return colorMap.get(str)!;
}

function formatDate(value: unknown): { full: string; year: string; monthDay: string } {
  if (!value) return { full: '', year: '', monthDay: '' };
  const d = new Date(String(value));
  if (isNaN(d.getTime())) return { full: String(value), year: '', monthDay: String(value) };
  const year = d.getFullYear().toString();
  const monthDay = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return { full: `${monthDay} ${year}`, year, monthDay };
}

function groupByYear(rows: RowData[], dateField: string): { year: string; rows: RowData[] }[] {
  const groups = new Map<string, RowData[]>();
  for (const row of rows) {
    const { year } = formatDate(row[dateField]);
    const key = year || '—';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }
  return [...groups.entries()].map(([year, rows]) => ({ year, rows }));
}

export function TimelineView({ view }: Props) {
  const { t } = useTranslation();
  const timeline = view.timeline;
  const [rows, setRows] = useState<RowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRow, setEditingRow] = useState<RowData | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getTableData(view.table_name, {
        page: 1,
        limit: 500,
        ...(timeline ? { sort: timeline.date_field, order: 'desc' } : {}),
      });
      setRows(result.rows);
    } catch (err) {
      toast.error(t('common_toast.load_failed'), { description: String(err) });
    } finally {
      setLoading(false);
    }
  }, [view.table_name, timeline?.date_field]);

  useEffect(() => { void fetchRows(); }, [fetchRows]);

  const handleUpdate = async (data: Record<string, unknown>) => {
    const id = editingRow?.id;
    if (id === undefined || id === null) return;
    try {
      await updateRow(view.table_name, id, data);
      toast.success(t('common_toast.update_success'));
      setEditingRow(null);
      void fetchRows();
    } catch (err) {
      toast.error(t('common_toast.update_failed'), { description: String(err) });
    }
  };

  if (!timeline) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Timeline configuration is missing</div>;
  }

  if (loading) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{t('common.loading')}</div>;
  }

  const { date_field, title_field, description_field, color_field } = timeline;
  const colorMap = new Map<string, string>();
  const groups = groupByYear(rows, date_field);

  const visibleFieldCount = view.form.fields.filter(f => !f.hidden_in_form).length;
  const formColumns = view.form.columns ?? (visibleFieldCount >= 5 ? 2 : 1);
  const dialogWidthClass = formColumns === 3 ? 'max-w-4xl' : formColumns === 2 ? 'max-w-2xl' : 'max-w-lg';

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-auto">
        {rows.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{t('common.no_data')}</div>
        ) : (
          <div className="mx-auto max-w-2xl px-6 py-8 space-y-8">
            {groups.map(({ year, rows: groupRows }) => (
              <div key={year}>
                {/* Year divider */}
                <div className="mb-5 flex items-center gap-3">
                  <span className="text-xs font-semibold tracking-widest text-muted-foreground">{year}</span>
                  <div className="flex-1 border-t border-dashed border-border" />
                </div>

                {/* Timeline items */}
                <div className="space-y-0">
                  {groupRows.map((row, idx) => {
                    const color = color_field ? resolveColor(row[color_field], colorMap) : resolveColor(null, colorMap);
                    const title = String(row[title_field] ?? '');
                    const desc = description_field ? String(row[description_field] ?? '') : '';
                    const { monthDay } = formatDate(row[date_field]);
                    const isLast = idx === groupRows.length - 1;

                    return (
                      <div key={String(row.id ?? idx)} className="flex gap-0">
                        {/* Left: date */}
                        <div className="w-20 shrink-0 pt-3.5 pr-4 text-right">
                          <span className="text-xs text-muted-foreground tabular-nums">{monthDay}</span>
                        </div>

                        {/* Center: dot + line */}
                        <div className="flex flex-col items-center">
                          <div
                            className="z-10 mt-3 h-4 w-4 shrink-0 rounded-full ring-2 ring-background"
                            style={{ backgroundColor: color }}
                          />
                          {!isLast && (
                            <div className="w-px flex-1 bg-border" style={{ minHeight: '1.5rem' }} />
                          )}
                        </div>

                        {/* Right: card */}
                        <div className="flex-1 pb-5 pl-4">
                          <div
                            className="group cursor-pointer rounded-lg border bg-card px-4 py-3 shadow-sm transition-shadow hover:shadow-md"
                            style={{ borderLeftWidth: '3px', borderLeftColor: color }}
                            onClick={() => setEditingRow(row)}
                          >
                            <p className="text-sm font-semibold leading-snug">{title || '—'}</p>
                            {desc && (
                              <p className="mt-1 text-xs leading-relaxed text-muted-foreground line-clamp-2">{desc}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={Boolean(editingRow)} onOpenChange={open => (!open ? setEditingRow(null) : null)}>
        <DialogContent className={dialogWidthClass}>
          <DialogHeader>
            <DialogTitle>{t('table.view.edit_dialog_title', { name: view.name })}</DialogTitle>
            <DialogDescription>{t('table.view.edit_dialog_desc')}</DialogDescription>
          </DialogHeader>
          {editingRow && (
            <FormView
              fields={view.form.fields}
              columns={formColumns}
              initialValues={editingRow}
              onSubmit={handleUpdate}
              onCancel={() => setEditingRow(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
