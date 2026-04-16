import { useEffect, useState } from 'react';
import {
  Loader2, RefreshCw, Trash2, X, ChevronDown, ChevronRight, Info,
  Eye, EyeOff, Lock, Unlock, Palette, Type, AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../ui/alert-dialog';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AppearanceRuleRow {
  view_id: string;
  view_name: string;
  table_name: string;
  scope: 'form' | 'column';
  field_key: string;
  field_label: string;
  rule_index: number;
  rule: {
    when: Record<string, unknown>;
    apply: {
      visibility?: 'hidden' | 'visible';
      enabled?: boolean;
      required?: boolean;
      text_color?: string;
      bg_color?: string;
      font_weight?: 'normal' | 'bold';
    };
    enabled?: boolean;
  };
}

interface Props {
  onClose: () => void;
}

// ─── Labels & Helpers ────────────────────────────────────────────────────────

const SCOPE_LABEL: Record<string, string> = {
  form:   '表單',
  column: '表格欄',
};

const OPERATOR_LABEL: Record<string, string> = {
  eq: '=', neq: '≠', gt: '>', lt: '<', gte: '≥', lte: '≤', contains: '包含',
};

function conditionText(when: Record<string, unknown>): string {
  if ('logic' in when) {
    const logic = when.logic as string;
    const conditions = (when.conditions as Array<Record<string, unknown>>) ?? [];
    return `(${conditions.map(c => conditionText(c)).join(` ${logic.toUpperCase()} `)})`;
  }
  const op = OPERATOR_LABEL[String(when.operator)] ?? String(when.operator);
  const val = when.value !== undefined ? ` "${String(when.value)}"` : '';
  return `${when.field} ${op}${val}`;
}

function effectIcons(apply: AppearanceRuleRow['rule']['apply']) {
  const items: { icon: React.ReactNode; label: string }[] = [];
  if (apply.visibility === 'hidden')   items.push({ icon: <EyeOff className="h-3 w-3" />, label: '隱藏' });
  if (apply.visibility === 'visible')  items.push({ icon: <Eye className="h-3 w-3" />, label: '顯示' });
  if (apply.enabled === false)         items.push({ icon: <Lock className="h-3 w-3" />, label: '唯讀' });
  if (apply.enabled === true)          items.push({ icon: <Unlock className="h-3 w-3" />, label: '啟用' });
  if (apply.required)                  items.push({ icon: <AlertCircle className="h-3 w-3" />, label: '必填' });
  if (apply.text_color || apply.font_weight) items.push({ icon: <Type className="h-3 w-3" />, label: '文字樣式' });
  if (apply.bg_color)                  items.push({ icon: <Palette className="h-3 w-3" />, label: '背景色' });
  return items;
}

/** 唯一 key 用來識別一條規則 */
function ruleKey(row: AppearanceRuleRow) {
  return `${row.view_id}::${row.scope}::${row.field_key}::${row.rule_index}`;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AppearanceManagement({ onClose }: Props) {
  const { token } = useAuth();
  const [rows, setRows] = useState<AppearanceRuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<AppearanceRuleRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const fetchRules = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/appearance', { headers });
      if (res.ok) {
        const data = await res.json() as AppearanceRuleRow[];
        setRows(data);
        // 預設展開所有群組
        const groups = new Set(data.map(r => r.view_id));
        setExpandedGroups(groups);
      } else {
        toast.error('載入失敗');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchRules(); }, []);

  const handleToggle = async (row: AppearanceRuleRow) => {
    const key = ruleKey(row);
    setToggling(key);
    try {
      const res = await fetch('/api/admin/appearance/toggle', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          view_id: row.view_id,
          scope: row.scope,
          field_key: row.field_key,
          rule_index: row.rule_index,
        }),
      });
      if (!res.ok) { toast.error('切換失敗'); return; }
      const data = await res.json() as { enabled: boolean };
      const enabledLabel = data.enabled ? '啟用' : '停用';
      toast.success(`已${enabledLabel}「${row.view_name} / ${row.field_label}」的外觀規則`);
      setRows(prev => prev.map(r =>
        ruleKey(r) === key ? { ...r, rule: { ...r.rule, enabled: data.enabled } } : r
      ));
    } finally {
      setToggling(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await fetch('/api/admin/appearance/rule', {
        method: 'DELETE',
        headers,
        body: JSON.stringify({
          view_id: deleteTarget.view_id,
          scope: deleteTarget.scope,
          field_key: deleteTarget.field_key,
          rule_index: deleteTarget.rule_index,
        }),
      });
      const json = await res.json() as { success?: boolean; error?: string };
      if (!res.ok) { toast.error(json.error ?? '刪除失敗'); return; }
      toast.success('外觀規則已刪除');
      const key = ruleKey(deleteTarget);
      setRows(prev => prev.filter(r => ruleKey(r) !== key));
      setDeleteTarget(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  // 依 view 分群
  const viewGroups = rows.reduce<Map<string, { view_name: string; table_name: string; rows: AppearanceRuleRow[] }>>(
    (map, row) => {
      if (!map.has(row.view_id)) {
        map.set(row.view_id, { view_name: row.view_name, table_name: row.table_name, rows: [] });
      }
      map.get(row.view_id)!.rows.push(row);
      return map;
    },
    new Map(),
  );

  const toggleGroup = (viewId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(viewId) ? next.delete(viewId) : next.add(viewId);
      return next;
    });
  };

  const enabledCount = rows.filter(r => r.rule.enabled !== false).length;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div
          className="flex w-full max-w-5xl flex-col overflow-hidden rounded-xl border bg-background shadow-xl"
          style={{ maxHeight: '88vh' }}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b px-6 py-4">
            <div>
              <h2 className="text-base font-semibold">條件外觀管理</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                共 {rows.length} 條外觀規則，{enabledCount} 條啟用中，涵蓋 {viewGroups.size} 個介面
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => void fetchRules()} title="重新整理" disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
                <Info className="h-8 w-8 opacity-40" />
                <p className="text-sm">尚未設定任何條件外觀規則</p>
                <p className="text-xs">請透過 AI 助理為欄位加入 appearance 規則</p>
              </div>
            ) : (
              <div className="divide-y">
                {Array.from(viewGroups.entries()).map(([viewId, group]) => {
                  const isExpanded = expandedGroups.has(viewId);
                  const groupEnabled = group.rows.filter(r => r.rule.enabled !== false).length;

                  return (
                    <div key={viewId}>
                      {/* Group header */}
                      <button
                        className="flex w-full items-center gap-3 px-6 py-3 hover:bg-muted/40 text-left"
                        onClick={() => toggleGroup(viewId)}
                      >
                        {isExpanded
                          ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                          : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-sm">{group.view_name}</span>
                          <span className="ml-2 font-mono text-xs text-muted-foreground">{group.table_name}</span>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {groupEnabled}/{group.rows.length} 條啟用
                        </span>
                      </button>

                      {/* Rules */}
                      {isExpanded && (
                        <div className="bg-muted/10 divide-y divide-border/50">
                          {group.rows.map(row => {
                            const key = ruleKey(row);
                            const isEnabled = row.rule.enabled !== false;
                            const icons = effectIcons(row.rule.apply);

                            return (
                              <div
                                key={key}
                                className={`flex items-start gap-4 px-8 py-3 ${!isEnabled ? 'opacity-50' : ''}`}
                              >
                                {/* Scope + field */}
                                <div className="w-40 shrink-0 pt-0.5">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <Badge variant="outline" className="text-xs font-normal">
                                      {SCOPE_LABEL[row.scope]}
                                    </Badge>
                                    <span className="font-medium text-sm">{row.field_label}</span>
                                  </div>
                                  <span className="font-mono text-xs text-muted-foreground">{row.field_key}</span>
                                </div>

                                {/* Condition */}
                                <div className="flex-1 min-w-0 pt-0.5">
                                  <div className="text-xs text-muted-foreground mb-1">條件</div>
                                  <code className="text-xs bg-muted px-2 py-0.5 rounded break-all">
                                    {conditionText(row.rule.when)}
                                  </code>
                                </div>

                                {/* Effects */}
                                <div className="w-44 shrink-0 pt-0.5">
                                  <div className="text-xs text-muted-foreground mb-1.5">效果</div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {icons.map((item, i) => (
                                      <span
                                        key={i}
                                        className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs"
                                      >
                                        {item.icon}
                                        {item.label}
                                      </span>
                                    ))}
                                    {/* Color swatches */}
                                    {row.rule.apply.text_color && (
                                      <span
                                        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs border"
                                        style={{ color: row.rule.apply.text_color }}
                                      >
                                        <span
                                          className="inline-block h-2.5 w-2.5 rounded-full border border-border/50"
                                          style={{ backgroundColor: row.rule.apply.text_color }}
                                        />
                                        文字
                                      </span>
                                    )}
                                    {row.rule.apply.bg_color && (
                                      <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs border">
                                        <span
                                          className="inline-block h-2.5 w-2.5 rounded-full border border-border/50"
                                          style={{ backgroundColor: row.rule.apply.bg_color }}
                                        />
                                        背景
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Toggle + Delete */}
                                <div className="shrink-0 flex items-center gap-2 pt-0.5">
                                  <Switch
                                    checked={isEnabled}
                                    disabled={toggling === key}
                                    onCheckedChange={() => void handleToggle(row)}
                                  />
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    title="刪除此外觀規則"
                                    onClick={() => setDeleteTarget(row)}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {!loading && rows.length > 0 && (
            <div className="shrink-0 border-t px-6 py-3 text-xs text-muted-foreground">
              條件外觀規則嵌入於介面定義中，可透過 AI 助理新增或修改規則。
            </div>
          )}
        </div>
      </div>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除外觀規則</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除「<span className="font-medium">{deleteTarget?.view_name}</span>」介面中，
              欄位「<span className="font-medium">{deleteTarget?.field_label}</span>」的這條外觀規則？
              刪除後無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleDelete()}
              disabled={deleteLoading}
            >
              {deleteLoading && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
