import { useEffect, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { runQuery } from '../../api';
import type { DashboardWidget, ViewDefinition } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { cn } from '../../lib/cn';

interface Props {
  view: ViewDefinition;
}

// 12-column grid helpers
function colSpanClass(size: DashboardWidget['size']) {
  switch (size) {
    case 'sm':   return 'col-span-12 sm:col-span-6 lg:col-span-3';
    case 'md':   return 'col-span-12 sm:col-span-6';
    case 'lg':   return 'col-span-12 lg:col-span-9';
    case 'full': return 'col-span-12';
    default:     return 'col-span-12 sm:col-span-6';
  }
}

const CHART_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export function DashboardView({ view }: Props) {
  const widgets = view.widgets ?? [];

  if (widgets.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        此 Dashboard 尚無 widget
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-6">
      <h2 className="mb-5 text-lg font-semibold">{view.name}</h2>
      <div className="grid grid-cols-12 gap-4">
        {widgets.map(widget => (
          <div key={widget.id} className={colSpanClass(widget.size)}>
            <WidgetRenderer widget={widget} />
          </div>
        ))}
      </div>
    </div>
  );
}

function WidgetRenderer({ widget }: { widget: DashboardWidget }) {
  const [data, setData] = useState<Record<string, unknown>[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    runQuery(widget.query)
      .then(rows => { if (!cancelled) setData(rows); })
      .catch(err => { if (!cancelled) setError(String(err)); });
    return () => { cancelled = true; };
  }, [widget.query]);

  if (error) {
    return (
      <Card className="border-destructive/40">
        <CardHeader><CardTitle className="text-sm text-destructive">{widget.title}</CardTitle></CardHeader>
        <CardContent><p className="text-xs text-destructive">{error}</p></CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-sm">{widget.title}</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-20 w-full" /></CardContent>
      </Card>
    );
  }

  switch (widget.type) {
    case 'stat_card':   return <StatCard title={widget.title} data={data} />;
    case 'bar_chart':   return <BarChartWidget title={widget.title} data={data} config={widget.config} />;
    case 'line_chart':  return <LineChartWidget title={widget.title} data={data} config={widget.config} />;
    case 'pie_chart':   return <PieChartWidget title={widget.title} data={data} config={widget.config} />;
    case 'mini_table':  return <MiniTableWidget title={widget.title} data={data} />;
    case 'trend_card':  return <TrendCard widget={widget} data={data} />;
    default:            return null;
  }
}

// ===== Stat Card =====

function StatCard({ title, data }: { title: string; data: Record<string, unknown>[] }) {
  const row = data[0] ?? {};
  const value = row.value ?? row.count ?? row.total ?? Object.values(row)[0] ?? 0;
  const num = Number(value);
  const display = Number.isFinite(num) ? num.toLocaleString('zh-TW') : String(value);

  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="mt-1 text-3xl font-bold tracking-tight">{display}</p>
      </CardContent>
    </Card>
  );
}

// ===== Bar Chart =====

function BarChartWidget({
  title, data, config,
}: { title: string; data: Record<string, unknown>[]; config?: Record<string, unknown> }) {
  const xKey = String(config?.x_key ?? config?.label_key ?? 'label');
  const yKey = String(config?.y_key ?? config?.value_key ?? 'value');
  const color = String(config?.color ?? CHART_COLORS[0]);

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey={yKey} fill={color} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ===== Line Chart =====

function LineChartWidget({
  title, data, config,
}: { title: string; data: Record<string, unknown>[]; config?: Record<string, unknown> }) {
  const xKey = String(config?.x_key ?? config?.label_key ?? 'label');
  const yKey = String(config?.y_key ?? config?.value_key ?? 'value');
  const color = String(config?.color ?? CHART_COLORS[0]);

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Line type="monotone" dataKey={yKey} stroke={color} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ===== Pie Chart =====

function PieChartWidget({
  title, data, config,
}: { title: string; data: Record<string, unknown>[]; config?: Record<string, unknown> }) {
  const labelKey = String(config?.label_key ?? config?.x_key ?? 'label');
  const valueKey = String(config?.value_key ?? config?.y_key ?? 'value');

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={data}
              dataKey={valueKey}
              nameKey={labelKey}
              cx="50%"
              cy="50%"
              outerRadius={70}
              label={false}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ===== Trend Card =====

function TrendCard({ widget, data }: { widget: DashboardWidget; data: Record<string, unknown>[] }) {
  const row = data[0];
  if (!row) {
    return (
      <Card className="h-full">
        <CardContent className="pt-6 text-sm text-muted-foreground">無資料</CardContent>
      </Card>
    );
  }
  const curr = Number(row.current_value ?? 0);
  const prev = Number(row.previous_value ?? 0);
  const delta = prev === 0 ? null : ((curr - prev) / Math.abs(prev)) * 100;
  const isUp = delta !== null && delta >= 0;

  return (
    <Card className="h-full">
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-medium text-muted-foreground">{widget.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold tracking-tight">{curr.toLocaleString('zh-TW')}</p>
        {delta !== null && (
          <p className={cn('mt-1 text-sm font-medium', isUp ? 'text-emerald-600' : 'text-rose-600')}>
            {isUp ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%
          </p>
        )}
        {row.label != null && <p className="mt-1 text-xs text-muted-foreground">{String(row.label)}</p>}
      </CardContent>
    </Card>
  );
}

// ===== Mini Table =====

function MiniTableWidget({ title, data }: { title: string; data: Record<string, unknown>[] }) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
        <CardContent><p className="text-xs text-muted-foreground">無資料</p></CardContent>
      </Card>
    );
  }

  const columns = Object.keys(data[0]);

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent className="p-0">
        <div className="overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/50">
                {columns.map(col => (
                  <th key={col} className="px-3 py-2 text-left font-medium text-muted-foreground">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 10).map((row, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                  {columns.map(col => (
                    <td key={col} className="px-3 py-1.5">{String(row[col] ?? '-')}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
