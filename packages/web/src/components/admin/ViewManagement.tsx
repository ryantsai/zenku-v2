import { useEffect, useRef, useState } from 'react';
import {
  Loader2, RefreshCw, X, ChevronDown, ChevronRight,
  Eye, EyeOff, Lock, Unlock, AlertCircle, Palette, Type,
  Trash2, Table2, FileText, Zap, Info,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { Input } from '../ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../ui/alert-dialog';
import { toast } from 'sonner';
import type { ViewDefinition, FieldDef, ColumnDef } from '../../types';
import type { AppearanceRule, AppearanceEffect } from '../../types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AdminView {
  id: string;
  name: string;
  table_name: string;
  definition: ViewDefinition;
  created_at: string;
  updated_at: string;
}

interface Props { onClose: () => void; }

// ─── Constants ───────────────────────────────────────────────────────────────

const VIEW_TYPE_LABEL: Record<string, string> = {
  'table': '表格', 'master-detail': '主明細',
  'dashboard': '儀表板', 'kanban': '看板', 'calendar': '日曆',
};
const VIEW_TYPE_COLOR: Record<string, string> = {
  'table': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  'master-detail': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  'dashboard': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  'kanban': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  'calendar': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};
const FIELD_TYPE_COLOR: Record<string, string> = {
  text: 'bg-gray-100 text-gray-600', number: 'bg-blue-50 text-blue-600',
  currency: 'bg-green-50 text-green-600', date: 'bg-orange-50 text-orange-600',
  boolean: 'bg-purple-50 text-purple-600', select: 'bg-yellow-50 text-yellow-600',
  relation: 'bg-indigo-50 text-indigo-600', email: 'bg-pink-50 text-pink-600',
  url: 'bg-cyan-50 text-cyan-600', textarea: 'bg-gray-50 text-gray-500',
};
const OP_LABEL: Record<string, string> = {
  eq: '=', neq: '≠', gt: '>', lt: '<', gte: '≥', lte: '≤', contains: '包含',
};
const ACTION_LABEL: Record<string, string> = {
  create: '新增', edit: '編輯', delete: '刪除', export: '匯出',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function countAppearanceRules(view: ViewDefinition): number {
  const formRules = (view.form?.fields ?? []).reduce((n, f) => n + (f.appearance?.length ?? 0), 0);
  const colRules  = (view.columns ?? []).reduce((n, c) => n + (c.appearance?.length ?? 0), 0);
  const detailRules = (view.detail_views ?? []).reduce((n, dv) => {
    const dvForm = (dv.view.form?.fields ?? []).reduce((m, f) => m + (f.appearance?.length ?? 0), 0);
    const dvCol  = (dv.view.columns ?? []).reduce((m, c) => m + (c.appearance?.length ?? 0), 0);
    return n + dvForm + dvCol;
  }, 0);
  return formRules + colRules + detailRules;
}

function conditionText(when: Record<string, unknown>): string {
  if ('logic' in when) {
    const sub = (when.conditions as Array<Record<string, unknown>> ?? []).map(c => conditionText(c));
    return `(${sub.join(` ${String(when.logic).toUpperCase()} `)})`;
  }
  const op  = OP_LABEL[String(when.operator)] ?? String(when.operator);
  const val = when.value !== undefined ? ` "${String(when.value)}"` : '';
  return `${when.field} ${op}${val}`;
}

function effectItems(apply: AppearanceEffect): Array<{ icon: React.ReactNode; label: string }> {
  const items: Array<{ icon: React.ReactNode; label: string }> = [];
  if (apply.visibility === 'hidden')  items.push({ icon: <EyeOff className="h-3 w-3" />, label: '隱藏' });
  if (apply.visibility === 'visible') items.push({ icon: <Eye className="h-3 w-3" />, label: '顯示' });
  if (apply.enabled === false)        items.push({ icon: <Lock className="h-3 w-3" />, label: '唯讀' });
  if (apply.enabled === true)         items.push({ icon: <Unlock className="h-3 w-3" />, label: '啟用' });
  if (apply.required)                 items.push({ icon: <AlertCircle className="h-3 w-3" />, label: '必填' });
  if (apply.text_color || apply.font_weight) items.push({ icon: <Type className="h-3 w-3" />, label: '文字' });
  if (apply.bg_color)                 items.push({ icon: <Palette className="h-3 w-3" />, label: '背景' });
  return items;
}

// ─── Inline label editor ─────────────────────────────────────────────────────

function LabelEditor({
  initialValue, onSave,
}: { initialValue: string; onSave: (val: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const save = async () => {
    if (value.trim() === initialValue || !value.trim()) { setEditing(false); setValue(initialValue); return; }
    setSaving(true);
    await onSave(value.trim());
    setSaving(false);
    setEditing(false);
  };

  if (editing) {
    return (
      <Input
        ref={inputRef}
        value={value}
        className="h-6 px-1.5 py-0 text-sm w-36"
        onChange={e => setValue(e.target.value)}
        onBlur={() => void save()}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); void save(); }
          if (e.key === 'Escape') { setEditing(false); setValue(initialValue); }
        }}
        disabled={saving}
        autoFocus
      />
    );
  }
  return (
    <button
      className="text-sm font-medium hover:text-primary hover:underline text-left truncate max-w-[9rem]"
      title="點擊編輯標籤名稱"
      onClick={() => { setEditing(true); setValue(initialValue); }}
    >
      {initialValue}
    </button>
  );
}

// ─── Appearance rule list ─────────────────────────────────────────────────────

function AppearanceRuleList({
  rules, onToggle, onDelete,
}: {
  rules: AppearanceRule[];
  onToggle: (ruleIndex: number, nextEnabled: boolean) => void;
  onDelete: (ruleIndex: number) => void;
}) {
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);

  if (rules.length === 0) {
    return <p className="px-4 py-2 text-xs text-muted-foreground italic">此欄位無外觀規則</p>;
  }
  return (
    <div className="divide-y divide-border/40">
      {rules.map((rule, i) => {
        const isEnabled = rule.enabled !== false;
        const items = effectItems(rule.apply);
        return (
          <div key={i} className={`flex items-start gap-3 px-4 py-2.5 ${!isEnabled ? 'opacity-50' : ''}`}>
            {/* Index */}
            <span className="shrink-0 mt-0.5 text-xs font-mono text-muted-foreground w-4">{i + 1}</span>

            {/* Condition */}
            <div className="flex-1 min-w-0">
              <div className="text-xs text-muted-foreground mb-1">當</div>
              <code className="text-xs bg-muted/70 px-1.5 py-0.5 rounded break-all">
                {conditionText(rule.when as Record<string, unknown>)}
              </code>
            </div>

            {/* Effects */}
            <div className="w-36 shrink-0">
              <div className="text-xs text-muted-foreground mb-1">效果</div>
              <div className="flex flex-wrap gap-1">
                {items.map((item, j) => (
                  <span key={j} className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs">
                    {item.icon}{item.label}
                  </span>
                ))}
                {rule.apply.text_color && (
                  <span className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs"
                    style={{ color: rule.apply.text_color }}>
                    <span className="h-2 w-2 rounded-full border" style={{ backgroundColor: rule.apply.text_color }} />
                    文字
                  </span>
                )}
                {rule.apply.bg_color && (
                  <span className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs">
                    <span className="h-2 w-2 rounded-full border" style={{ backgroundColor: rule.apply.bg_color }} />
                    背景
                  </span>
                )}
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
              <Switch
                checked={isEnabled}
                onCheckedChange={checked => onToggle(i, checked)}
              />
              <Button variant="ghost" size="icon" className="h-6 w-6"
                onClick={() => setDeletingIndex(i)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          </div>
        );
      })}

      <AlertDialog open={deletingIndex !== null} onOpenChange={open => { if (!open) setDeletingIndex(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除外觀規則</AlertDialogTitle>
            <AlertDialogDescription>刪除後無法復原，且立即生效。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deletingIndex !== null) { onDelete(deletingIndex); setDeletingIndex(null); } }}
            >刪除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Form Field row ───────────────────────────────────────────────────────────

function FieldRow({
  field, onSaveLabel, onToggle, onAppearanceToggle, onAppearanceDelete,
}: {
  field: FieldDef;
  onSaveLabel: (key: string, label: string) => Promise<void>;
  onToggle: (key: string, prop: 'required' | 'hidden_in_form', val: boolean) => Promise<void>;
  onAppearanceToggle: (fieldKey: string, ruleIndex: number, nextEnabled: boolean) => void;
  onAppearanceDelete: (fieldKey: string, ruleIndex: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const ruleCount = field.appearance?.length ?? 0;

  return (
    <div className="border-b border-border/50 last:border-0">
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20">
        {/* Expand toggle */}
        <button
          className="shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => setExpanded(e => !e)}
        >
          {expanded
            ? <ChevronDown className="h-3.5 w-3.5" />
            : <ChevronRight className="h-3.5 w-3.5" />}
        </button>

        {/* Key */}
        <span className="w-32 shrink-0 font-mono text-xs text-muted-foreground truncate" title={field.key}>
          {field.key}
        </span>

        {/* Label (editable) */}
        <div className="w-36 shrink-0">
          <LabelEditor
            initialValue={field.label}
            onSave={val => onSaveLabel(field.key, val)}
          />
        </div>

        {/* Type */}
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${FIELD_TYPE_COLOR[field.type] ?? 'bg-gray-100 text-gray-600'}`}>
          {field.type}
        </span>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Required */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-muted-foreground w-6">必填</span>
          <Switch
            checked={!!field.required}
            disabled={!!field.computed}
            onCheckedChange={v => void onToggle(field.key, 'required', v)}
          />
        </div>

        {/* Hidden in form */}
        <div className="flex items-center gap-1.5 shrink-0 ml-3">
          <span className="text-xs text-muted-foreground w-8">隱藏</span>
          <Switch
            checked={!!field.hidden_in_form}
            onCheckedChange={v => void onToggle(field.key, 'hidden_in_form', v)}
          />
        </div>

        {/* Appearance rules badge */}
        <button
          className="ml-3 shrink-0"
          onClick={() => setExpanded(e => !e)}
          title="外觀規則"
        >
          <Badge
            variant={ruleCount > 0 ? 'default' : 'outline'}
            className="text-xs"
          >
            {ruleCount} 條外觀
          </Badge>
        </button>
      </div>

      {/* Appearance rules (expanded) */}
      {expanded && (
        <div className="bg-muted/10 ml-8 border-l-2 border-border/30">
          <AppearanceRuleList
            rules={field.appearance ?? []}
            onToggle={(idx, next) => onAppearanceToggle(field.key, idx, next)}
            onDelete={idx => onAppearanceDelete(field.key, idx)}
          />
        </div>
      )}
    </div>
  );
}

// ─── Column row ───────────────────────────────────────────────────────────────

function ColumnRow({
  col, onSaveLabel, onToggle, onAppearanceToggle, onAppearanceDelete,
}: {
  col: ColumnDef;
  onSaveLabel: (key: string, label: string) => Promise<void>;
  onToggle: (key: string, prop: 'hidden_in_table', val: boolean) => Promise<void>;
  onAppearanceToggle: (fieldKey: string, ruleIndex: number, nextEnabled: boolean) => void;
  onAppearanceDelete: (fieldKey: string, ruleIndex: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const ruleCount = col.appearance?.length ?? 0;

  return (
    <div className="border-b border-border/50 last:border-0">
      <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20">
        <button className="shrink-0 text-muted-foreground" onClick={() => setExpanded(e => !e)}>
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>

        <span className="w-32 shrink-0 font-mono text-xs text-muted-foreground truncate">{col.key}</span>

        <div className="w-36 shrink-0">
          <LabelEditor initialValue={col.label} onSave={val => onSaveLabel(col.key, val)} />
        </div>

        <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${FIELD_TYPE_COLOR[col.type] ?? 'bg-gray-100 text-gray-600'}`}>
          {col.type}
        </span>

        <div className="flex-1" />

        {col.sortable !== false && (
          <span className="text-xs text-muted-foreground shrink-0">可排序</span>
        )}

        <div className="flex items-center gap-1.5 shrink-0 ml-3">
          <span className="text-xs text-muted-foreground w-8">隱藏</span>
          <Switch
            checked={!!col.hidden_in_table}
            onCheckedChange={v => void onToggle(col.key, 'hidden_in_table', v)}
          />
        </div>

        <button className="ml-3 shrink-0" onClick={() => setExpanded(e => !e)}>
          <Badge variant={ruleCount > 0 ? 'default' : 'outline'} className="text-xs">
            {ruleCount} 條外觀
          </Badge>
        </button>
      </div>

      {expanded && (
        <div className="bg-muted/10 ml-8 border-l-2 border-border/30">
          <AppearanceRuleList
            rules={col.appearance ?? []}
            onToggle={(idx, next) => onAppearanceToggle(col.key, idx, next)}
            onDelete={idx => onAppearanceDelete(col.key, idx)}
          />
        </div>
      )}
    </div>
  );
}

// ─── Section wrappers (master + per-detail) ──────────────────────────────────

const FIELD_TABLE_HEADER = (
  <div className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background px-4 py-2 text-xs font-medium text-muted-foreground">
    <span className="w-3.5 shrink-0" />
    <span className="w-32 shrink-0">欄位名（DB）</span>
    <span className="w-36 shrink-0">標籤</span>
    <span className="w-16 shrink-0">類型</span>
    <div className="flex-1" />
    <span className="w-16 shrink-0 text-right">必填</span>
    <span className="w-16 shrink-0 text-right">隱藏</span>
    <span className="w-16 shrink-0 text-right">外觀規則</span>
  </div>
);

const COLUMN_TABLE_HEADER = (
  <div className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background px-4 py-2 text-xs font-medium text-muted-foreground">
    <span className="w-3.5 shrink-0" />
    <span className="w-32 shrink-0">欄位名（DB）</span>
    <span className="w-36 shrink-0">標籤</span>
    <span className="w-16 shrink-0">類型</span>
    <div className="flex-1" />
    <span className="w-16 shrink-0 text-right">隱藏</span>
    <span className="w-16 shrink-0 text-right">外觀規則</span>
  </div>
);

function FieldSection({
  title, fields,
  onSaveLabel, onToggle, onAppearanceToggle, onAppearanceDelete,
}: {
  title?: string;
  fields: FieldDef[];
  onSaveLabel: (key: string, label: string) => Promise<void>;
  onToggle: (key: string, prop: 'required' | 'hidden_in_form', val: boolean) => Promise<void>;
  onAppearanceToggle: (fieldKey: string, ruleIndex: number, nextEnabled: boolean) => void;
  onAppearanceDelete: (fieldKey: string, ruleIndex: number) => void;
}) {
  return (
    <div>
      {title && (
        <p className="mb-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</p>
      )}
      <div className="rounded-md border overflow-hidden">
        {FIELD_TABLE_HEADER}
        {fields.length === 0 ? (
          <p className="px-4 py-8 text-sm text-center text-muted-foreground">無表單欄位</p>
        ) : (
          fields.map(field => (
            <FieldRow
              key={field.key}
              field={field}
              onSaveLabel={onSaveLabel}
              onToggle={onToggle}
              onAppearanceToggle={onAppearanceToggle}
              onAppearanceDelete={onAppearanceDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ColumnSection({
  title, columns,
  onSaveLabel, onToggle, onAppearanceToggle, onAppearanceDelete,
}: {
  title?: string;
  columns: ColumnDef[];
  onSaveLabel: (key: string, label: string) => Promise<void>;
  onToggle: (key: string, prop: 'hidden_in_table', val: boolean) => Promise<void>;
  onAppearanceToggle: (fieldKey: string, ruleIndex: number, nextEnabled: boolean) => void;
  onAppearanceDelete: (fieldKey: string, ruleIndex: number) => void;
}) {
  return (
    <div>
      {title && (
        <p className="mb-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</p>
      )}
      <div className="rounded-md border overflow-hidden">
        {COLUMN_TABLE_HEADER}
        {columns.length === 0 ? (
          <p className="px-4 py-8 text-sm text-center text-muted-foreground">無列表欄位</p>
        ) : (
          columns.map(col => (
            <ColumnRow
              key={col.key}
              col={col}
              onSaveLabel={onSaveLabel}
              onToggle={onToggle}
              onAppearanceToggle={onAppearanceToggle}
              onAppearanceDelete={onAppearanceDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ViewManagement({ onClose }: Props) {
  const { token } = useAuth();
  const [views, setViews] = useState<AdminView[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const fetchViews = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/views', { headers });
      if (res.ok) {
        const data = await res.json() as AdminView[];
        setViews(data);
        if (data.length > 0 && !selectedId) setSelectedId(data[0].id);
      } else {
        toast.error('載入介面清單失敗');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchViews(); }, []);

  const selected = views.find(v => v.id === selectedId) ?? null;

  // ── Field property update ──
  const saveFieldProp = async (
    scope: 'form' | 'column',
    fieldKey: string,
    updates: Record<string, unknown>,
    detailIndex?: number,
  ) => {
    if (!selectedId) return;
    const res = await fetch(`/api/admin/views/${selectedId}/field-prop`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ scope, field_key: fieldKey, updates, detail_index: detailIndex }),
    });
    if (!res.ok) { toast.error('儲存失敗'); return; }
    setViews(prev => prev.map(v => {
      if (v.id !== selectedId) return v;
      const def = { ...v.definition };
      if (detailIndex !== undefined) {
        // Update field inside detail_views[detailIndex]
        const dvs = [...(def.detail_views ?? [])];
        const dv = dvs[detailIndex];
        if (!dv) return v;
        const dvView = { ...dv.view };
        if (scope === 'form') {
          dvView.form = {
            ...dvView.form,
            fields: (dvView.form as { fields: FieldDef[] }).fields.map(f =>
              f.key === fieldKey ? { ...f, ...updates } as FieldDef : f
            ),
          };
        } else {
          dvView.columns = (dvView.columns as ColumnDef[]).map(c =>
            c.key === fieldKey ? { ...c, ...updates } as ColumnDef : c
          );
        }
        dvs[detailIndex] = { ...dv, view: dvView as ViewDefinition };
        def.detail_views = dvs;
      } else {
        if (scope === 'form') {
          def.form = {
            ...def.form,
            fields: def.form.fields.map(f =>
              f.key === fieldKey ? { ...f, ...updates } as FieldDef : f
            ),
          };
        } else {
          def.columns = def.columns.map(c =>
            c.key === fieldKey ? { ...c, ...updates } as ColumnDef : c
          );
        }
      }
      return { ...v, definition: def };
    }));
  };

  // ── Appearance toggle ──
  const handleAppearanceToggle = async (
    scope: 'form' | 'column', fieldKey: string, ruleIndex: number, nextEnabled: boolean,
    detailIndex?: number,
  ) => {
    if (!selectedId) return;
    const res = await fetch('/api/admin/appearance/toggle', {
      method: 'PATCH', headers,
      body: JSON.stringify({ view_id: selectedId, scope, field_key: fieldKey, rule_index: ruleIndex, detail_index: detailIndex }),
    });
    if (!res.ok) { toast.error('切換失敗'); return; }

    const patchAppearance = (fields: FieldDef[] | ColumnDef[]) =>
      fields.map(f => {
        if (f.key !== fieldKey || !f.appearance) return f;
        return { ...f, appearance: f.appearance.map((r, i) => i === ruleIndex ? { ...r, enabled: nextEnabled } : r) };
      });

    setViews(prev => prev.map(v => {
      if (v.id !== selectedId) return v;
      const def = { ...v.definition };
      if (detailIndex !== undefined) {
        const dvs = [...(def.detail_views ?? [])];
        const dv = dvs[detailIndex];
        if (!dv) return v;
        const dvView = { ...dv.view };
        if (scope === 'form') dvView.form = { ...dvView.form, fields: patchAppearance((dvView.form as { fields: FieldDef[] }).fields) as FieldDef[] };
        else dvView.columns = patchAppearance(dvView.columns as ColumnDef[]) as ColumnDef[];
        dvs[detailIndex] = { ...dv, view: dvView as ViewDefinition };
        def.detail_views = dvs;
      } else {
        if (scope === 'form') def.form = { ...def.form, fields: patchAppearance(def.form.fields) as FieldDef[] };
        else def.columns = patchAppearance(def.columns) as ColumnDef[];
      }
      return { ...v, definition: def };
    }));
    toast.success(nextEnabled ? '已啟用外觀規則' : '已停用外觀規則');
  };

  // ── Appearance delete ──
  const handleAppearanceDelete = async (
    scope: 'form' | 'column', fieldKey: string, ruleIndex: number,
    detailIndex?: number,
  ) => {
    if (!selectedId) return;
    const res = await fetch('/api/admin/appearance/rule', {
      method: 'DELETE', headers,
      body: JSON.stringify({ view_id: selectedId, scope, field_key: fieldKey, rule_index: ruleIndex, detail_index: detailIndex }),
    });
    if (!res.ok) { toast.error('刪除失敗'); return; }

    const removeRule = (fields: FieldDef[] | ColumnDef[]) =>
      fields.map(f => {
        if (f.key !== fieldKey || !f.appearance) return f;
        const next = f.appearance.filter((_, i) => i !== ruleIndex);
        return { ...f, appearance: next.length ? next : undefined };
      });

    setViews(prev => prev.map(v => {
      if (v.id !== selectedId) return v;
      const def = { ...v.definition };
      if (detailIndex !== undefined) {
        const dvs = [...(def.detail_views ?? [])];
        const dv = dvs[detailIndex];
        if (!dv) return v;
        const dvView = { ...dv.view };
        if (scope === 'form') dvView.form = { ...dvView.form, fields: removeRule((dvView.form as { fields: FieldDef[] }).fields) as FieldDef[] };
        else dvView.columns = removeRule(dvView.columns as ColumnDef[]) as ColumnDef[];
        dvs[detailIndex] = { ...dv, view: dvView as ViewDefinition };
        def.detail_views = dvs;
      } else {
        if (scope === 'form') def.form = { ...def.form, fields: removeRule(def.form.fields) as FieldDef[] };
        else def.columns = removeRule(def.columns) as ColumnDef[];
      }
      return { ...v, definition: def };
    }));
    toast.success('外觀規則已刪除');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex w-full max-w-6xl overflow-hidden rounded-xl border bg-background shadow-xl"
        style={{ height: '90vh' }}>

        {/* ── Left: view list ── */}
        <div className="flex w-64 shrink-0 flex-col border-r">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-sm font-semibold">介面管理</h2>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7"
                onClick={() => void fetchViews()} disabled={loading}>
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : views.length === 0 ? (
              <p className="px-4 py-6 text-xs text-muted-foreground text-center">尚無介面定義</p>
            ) : (
              views.map(v => {
                const ruleCount = countAppearanceRules(v.definition);
                const isSelected = v.id === selectedId;
                return (
                  <button
                    key={v.id}
                    className={`w-full text-left px-4 py-3 border-b border-border/50 hover:bg-accent transition-colors ${isSelected ? 'bg-accent' : ''}`}
                    onClick={() => setSelectedId(v.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-sm truncate">{v.definition.name}</span>
                      <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-xs font-medium ${VIEW_TYPE_COLOR[v.definition.type] ?? ''}`}>
                        {VIEW_TYPE_LABEL[v.definition.type] ?? v.definition.type}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono truncate">{v.table_name}</span>
                      {v.definition.group && <span className="shrink-0">· {v.definition.group}</span>}
                    </div>
                    <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                      <span>{(v.definition.form?.fields ?? []).length} 欄位</span>
                      <span>{(v.definition.columns ?? []).length} 列欄</span>
                      {(v.definition.detail_views ?? []).length > 0 && (
                        <span>{v.definition.detail_views!.length} 明細</span>
                      )}
                      {ruleCount > 0 && <span className="text-primary font-medium">{ruleCount} 外觀規則</span>}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="border-t px-4 py-2.5 text-xs text-muted-foreground">
            共 {views.length} 個介面
          </div>
        </div>

        {/* ── Right: view detail ── */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {!selected ? (
            <div className="flex flex-1 items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Info className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">選取左側介面以查看詳情</p>
              </div>
            </div>
          ) : (
            <>
              {/* View header */}
              <div className="shrink-0 border-b px-6 py-3">
                <div className="flex items-center gap-3">
                  <h3 className="text-base font-semibold">{selected.definition.name}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${VIEW_TYPE_COLOR[selected.definition.type] ?? ''}`}>
                    {VIEW_TYPE_LABEL[selected.definition.type]}
                  </span>
                  {selected.definition.group && (
                    <Badge variant="outline" className="text-xs font-normal">{selected.definition.group}</Badge>
                  )}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  表格：<span className="font-mono">{selected.table_name}</span>
                  <span className="mx-2">·</span>
                  更新：{new Date(selected.updated_at).toLocaleString('zh-TW')}
                </div>
              </div>

              {/* Tabs */}
              <Tabs defaultValue="form" className="flex flex-1 flex-col overflow-hidden">
                <TabsList className="shrink-0 mx-6 mt-3 w-fit">
                  <TabsTrigger value="form" className="gap-1.5 text-xs">
                    <FileText className="h-3.5 w-3.5" />
                    表單欄位
                    <Badge variant="secondary" className="ml-1 text-xs">
                      {(selected.definition.form?.fields?.length ?? 0) +
                        (selected.definition.detail_views ?? []).reduce((n, dv) => n + (dv.view.form?.fields?.length ?? 0), 0)}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="column" className="gap-1.5 text-xs">
                    <Table2 className="h-3.5 w-3.5" />
                    列表欄位
                    <Badge variant="secondary" className="ml-1 text-xs">
                      {(selected.definition.columns?.length ?? 0) +
                        (selected.definition.detail_views ?? []).reduce((n, dv) => n + (dv.view.columns?.length ?? 0), 0)}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="action" className="gap-1.5 text-xs">
                    <Zap className="h-3.5 w-3.5" />
                    動作
                    <Badge variant="secondary" className="ml-1 text-xs">{selected.definition.actions?.length ?? 0}</Badge>
                  </TabsTrigger>
                </TabsList>

                {/* Form fields tab */}
                <TabsContent value="form" className="flex-1 overflow-y-auto mt-0 mx-6 mb-3 space-y-4">
                  <FieldSection
                    title={selected.definition.type === 'master-detail' ? `主表：${selected.definition.name}` : undefined}
                    fields={selected.definition.form?.fields ?? []}
                    onSaveLabel={(key, label) => saveFieldProp('form', key, { label })}
                    onToggle={(key, prop, val) => saveFieldProp('form', key, { [prop]: val })}
                    onAppearanceToggle={(key, idx, next) => void handleAppearanceToggle('form', key, idx, next)}
                    onAppearanceDelete={(key, idx) => void handleAppearanceDelete('form', key, idx)}
                  />
                  {(selected.definition.detail_views ?? []).map((dv, dvIdx) => (
                    <FieldSection
                      key={dv.table_name}
                      title={`明細：${dv.tab_label}（${dv.table_name}）`}
                      fields={dv.view.form?.fields ?? []}
                      onSaveLabel={(key, label) => saveFieldProp('form', key, { label }, dvIdx)}
                      onToggle={(key, prop, val) => saveFieldProp('form', key, { [prop]: val }, dvIdx)}
                      onAppearanceToggle={(key, idx, next) => void handleAppearanceToggle('form', key, idx, next, dvIdx)}
                      onAppearanceDelete={(key, idx) => void handleAppearanceDelete('form', key, idx, dvIdx)}
                    />
                  ))}
                </TabsContent>

                {/* Columns tab */}
                <TabsContent value="column" className="flex-1 overflow-y-auto mt-0 mx-6 mb-3 space-y-4">
                  <ColumnSection
                    title={selected.definition.type === 'master-detail' ? `主表：${selected.definition.name}` : undefined}
                    columns={selected.definition.columns ?? []}
                    onSaveLabel={(key, label) => saveFieldProp('column', key, { label })}
                    onToggle={(key, prop, val) => saveFieldProp('column', key, { [prop]: val })}
                    onAppearanceToggle={(key, idx, next) => void handleAppearanceToggle('column', key, idx, next)}
                    onAppearanceDelete={(key, idx) => void handleAppearanceDelete('column', key, idx)}
                  />
                  {(selected.definition.detail_views ?? []).map((dv, dvIdx) => (
                    <ColumnSection
                      key={dv.table_name}
                      title={`明細：${dv.tab_label}（${dv.table_name}）`}
                      columns={dv.view.columns ?? []}
                      onSaveLabel={(key, label) => saveFieldProp('column', key, { label }, dvIdx)}
                      onToggle={(key, prop, val) => saveFieldProp('column', key, { [prop]: val }, dvIdx)}
                      onAppearanceToggle={(key, idx, next) => void handleAppearanceToggle('column', key, idx, next, dvIdx)}
                      onAppearanceDelete={(key, idx) => void handleAppearanceDelete('column', key, idx, dvIdx)}
                    />
                  ))}
                </TabsContent>

                {/* Actions tab */}
                <TabsContent value="action" className="flex-1 overflow-y-auto mt-0 mx-6 mb-3">
                  <div className="rounded-md border p-4 space-y-4">
                    <div>
                      <p className="text-sm font-medium mb-2">目前動作</p>
                      <div className="flex flex-wrap gap-2">
                        {(selected.definition.actions ?? []).length === 0 ? (
                          <span className="text-sm text-muted-foreground italic">無動作</span>
                        ) : (
                          (selected.definition.actions ?? []).map((action, idx) => {
                            if (typeof action === 'string') {
                              return (
                                <Badge key={action} variant="secondary" className="text-sm px-3 py-1">
                                  {ACTION_LABEL[action] ?? action}
                                </Badge>
                              );
                            }
                            return (
                              <Badge key={action.id ?? idx} variant="outline" className="text-sm px-3 py-1">
                                {action.label}
                                <span className="ml-1 text-xs text-muted-foreground">({action.behavior.type})</span>
                              </Badge>
                            );
                          })
                        )}
                      </div>
                    </div>
                    <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
                      <p className="font-medium text-foreground">自定義動作（Phase 4）</p>
                      <p>未來將支援自訂按鈕，設定條件顯示 / 停用，並綁定以下行為：</p>
                      <ul className="ml-3 list-disc space-y-0.5">
                        <li>設定欄位值（如：將狀態改為「核准」）</li>
                        <li>觸發手動業務規則</li>
                        <li>呼叫外部 Webhook</li>
                        <li>跳轉到其他介面</li>
                      </ul>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
