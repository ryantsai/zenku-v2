import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { getTableData } from '../../api';
import type { ViewDefinition } from '../../types';
import { Button } from '../ui/button';
import { cn } from '../../lib/cn';

interface Props {
  view: ViewDefinition;
}

type RowData = Record<string, unknown>;

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

// Colour palette for color_field values
const EVENT_COLORS = [
  'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
  'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
  'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
  'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
];

function getColorClass(colorValue: string | undefined, colorMap: Map<string, number>) {
  if (!colorValue) return EVENT_COLORS[0];
  if (!colorMap.has(colorValue)) colorMap.set(colorValue, colorMap.size % EVENT_COLORS.length);
  return EVENT_COLORS[colorMap.get(colorValue)!];
}

export function CalendarView({ view }: Props) {
  const calendar = view.calendar;
  const [rows, setRows] = useState<RowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() }; // month: 0-indexed
  });

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getTableData(view.table_name, { page: 1, limit: 500 });
      setRows(result.rows);
    } catch (err) {
      toast.error('載入失敗', { description: String(err) });
    } finally {
      setLoading(false);
    }
  }, [view.table_name]);

  useEffect(() => { void fetchRows(); }, [fetchRows]);

  if (!calendar) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Calendar 設定缺失</div>;
  }

  const { date_field, title_field, color_field } = calendar;
  const colorMap = new Map<string, number>();

  // Build calendar grid
  const firstDay = new Date(current.year, current.month, 1);
  const lastDay = new Date(current.year, current.month + 1, 0);
  const startOffset = firstDay.getDay(); // 0=Sun
  const totalCells = Math.ceil((startOffset + lastDay.getDate()) / 7) * 7;

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) cells.push(new Date(current.year, current.month, d));
  while (cells.length < totalCells) cells.push(null);

  // Group events by date string (YYYY-MM-DD)
  const eventsByDate: Record<string, RowData[]> = {};
  for (const row of rows) {
    const dateVal = String(row[date_field] ?? '').slice(0, 10); // YYYY-MM-DD
    if (!dateVal) continue;
    if (!eventsByDate[dateVal]) eventsByDate[dateVal] = [];
    eventsByDate[dateVal].push(row);
  }

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const monthLabel = `${current.year} 年 ${current.month + 1} 月`;

  const prevMonth = () => setCurrent(c => {
    const m = c.month - 1;
    return m < 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: m };
  });
  const nextMonth = () => setCurrent(c => {
    const m = c.month + 1;
    return m > 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: m };
  });
  const goToday = () => {
    const now = new Date();
    setCurrent({ year: now.getFullYear(), month: now.getMonth() });
  };

  return (
    <div className="flex h-full flex-col">
      {/* Calendar header */}
      <div className="flex shrink-0 items-center justify-between border-b px-5 py-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToday}>今天</Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold">{monthLabel}</span>
        </div>
        {loading && <span className="text-xs text-muted-foreground">載入中...</span>}
      </div>

      {/* Weekday headers */}
      <div className="grid shrink-0 grid-cols-7 border-b">
        {WEEKDAYS.map(day => (
          <div key={day} className="py-2 text-center text-xs font-medium text-muted-foreground">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid flex-1 grid-cols-7 overflow-auto">
        {cells.map((date, idx) => {
          if (!date) {
            return <div key={`empty-${idx}`} className="min-h-[80px] border-b border-r bg-muted/20" />;
          }

          const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          const events = eventsByDate[dateStr] ?? [];
          const isToday = dateStr === todayStr;

          return (
            <div
              key={dateStr}
              className={cn(
                'min-h-[80px] border-b border-r p-1',
                isToday && 'bg-primary/5',
              )}
            >
              <span className={cn(
                'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs',
                isToday ? 'bg-primary text-primary-foreground font-semibold' : 'text-foreground',
              )}>
                {date.getDate()}
              </span>

              <div className="mt-0.5 space-y-0.5">
                {events.slice(0, 3).map((event, i) => {
                  const colorVal = color_field ? String(event[color_field] ?? '') : undefined;
                  return (
                    <div
                      key={i}
                      className={cn(
                        'truncate rounded px-1 py-0.5 text-xs leading-tight',
                        getColorClass(colorVal, colorMap),
                      )}
                      title={String(event[title_field] ?? '')}
                    >
                      {String(event[title_field] ?? '')}
                    </div>
                  );
                })}
                {events.length > 3 && (
                  <div className="px-1 text-xs text-muted-foreground">+{events.length - 3} 更多</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
