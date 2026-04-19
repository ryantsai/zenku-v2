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

// A small palette for auto-assigning category colors
const AUTO_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444',
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6',
];

function resolveColor(value: unknown, colorMap: Map<string, string>): string {
  if (!value) return '#94a3b8';
  const str = String(value);
  // Direct hex value
  if (/^#[0-9a-fA-F]{3,8}$/.test(str)) return str;
  // Category → auto color
  if (!colorMap.has(str)) {
    colorMap.set(str, AUTO_COLORS[colorMap.size % AUTO_COLORS.length]);
  }
  return colorMap.get(str)!;
}

function formatDate(value: unknown): string {
  if (!value) return '';
  const d = new Date(String(value));
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
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

  const visibleFieldCount = view.form.fields.filter(f => !f.hidden_in_form).length;
  const formColumns = view.form.columns ?? (visibleFieldCount >= 5 ? 2 : 1);
  const dialogWidthClass = formColumns === 3 ? 'max-w-4xl' : formColumns === 2 ? 'max-w-2xl' : 'max-w-lg';

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-auto px-6 py-6">
        {rows.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{t('common.no_data')}</div>
        ) : (
          <ol className="relative ml-4 border-l border-muted">
            {rows.map((row, idx) => {
              const color = color_field ? resolveColor(row[color_field], colorMap) : '#6366f1';
              const title = String(row[title_field] ?? '');
              const desc = description_field ? String(row[description_field] ?? '') : '';
              const date = formatDate(row[date_field]);

              return (
                <li
                  key={String(row.id ?? idx)}
                  className="group mb-8 ml-6 cursor-pointer"
                  onClick={() => setEditingRow(row)}
                >
                  {/* Timeline dot */}
                  <span
                    className="absolute -left-[11px] flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-background transition group-hover:scale-110"
                    style={{ backgroundColor: color }}
                  />

                  {/* Content */}
                  <div className="rounded-lg border bg-card p-4 shadow-sm transition group-hover:shadow-md">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold leading-tight">{title || '-'}</h3>
                      {date && (
                        <time className="shrink-0 text-xs text-muted-foreground">{date}</time>
                      )}
                    </div>
                    {desc && (
                      <p className="text-sm text-muted-foreground line-clamp-3">{desc}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
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
