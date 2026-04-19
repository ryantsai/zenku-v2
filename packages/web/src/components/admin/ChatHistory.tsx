import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Archive, ArchiveX, Trash2, Loader2, MessageSquare } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { SessionDetail } from './SessionDetail';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { toast } from 'sonner';

interface SessionRow {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  title: string | null;
  provider: string;
  model: string;
  message_count: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost_usd: number;
  created_at: string;
  updated_at: string;
  archived: number;
}

export function ChatHistory() {
  const { t, i18n } = useTranslation();
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };

  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterProvider, setFilterProvider] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  // Action states
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchSessions = async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20', archived: showArchived ? '1' : '0' });
    if (filterProvider) params.set('provider', filterProvider);
    const res = await fetch(`/api/admin/sessions?${params}`, { headers });
    if (res.ok) {
      const data = await res.json() as { sessions: SessionRow[]; total: number };
      setSessions(data.sessions);
      setTotal(data.total);
    }
    setLoading(false);
  };

  useEffect(() => { void fetchSessions(); }, [page, filterProvider, showArchived]);

  const toggleArchive = async (s: SessionRow, e: React.MouseEvent) => {
    e.stopPropagation();
    setSavingId(s.id);
    const action = s.archived ? 'unarchive' : 'archive';
    const res = await fetch(`/api/admin/sessions/${s.id}/${action}`, { method: 'PATCH', headers });
    if (res.ok) {
      toast.success(s.archived ? t('admin.chat.toast_unarchived') : t('admin.chat.toast_archived'));
      void fetchSessions();
    } else {
      toast.error(t('common.error'));
    }
    setSavingId(null);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/admin/sessions/${deleteId}`, { method: 'DELETE', headers });
      const json = await res.json() as { success?: boolean; error?: string };
      if (!res.ok) {
        toast.error(t(`errors.${json.error}`, { defaultValue: json.error || t('common.error') }));
      } else {
        toast.success(t('admin.chat.toast_deleted'));
        setDeleteId(null);
        if (selectedId === deleteId) setSelectedId(null);
        void fetchSessions();
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  const totalPages = Math.ceil(total / 20);
  const deleteTarget = sessions.find(s => s.id === deleteId);

  return (
    <>
      {/* ── Master-detail layout ── */}
      <div className="flex h-full overflow-hidden">

        {/* ── Left: session list ── */}
        <div className="flex w-72 shrink-0 flex-col border-r">
          {/* List header */}
          <div className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">{t('admin.chat.title')}</h2>
              <p className="text-xs text-muted-foreground">{t('admin.chat.summary_sessions', { count: total })}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => void fetchSessions()} title={t('common.refresh')}>
              <RefreshCw size={14} />
            </Button>
          </div>

          {/* Filters */}
          <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2">
            <button
              onClick={() => { setPage(1); setShowArchived(v => !v); }}
              className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors ${
                showArchived
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:bg-accent'
              }`}
            >
              <Archive size={11} />
              {showArchived ? t('admin.chat.filter_archived') : t('admin.chat.filter_normal')}
            </button>
            <select
              value={filterProvider}
              onChange={e => { setPage(1); setFilterProvider(e.target.value); }}
              className="flex-1 rounded border bg-background px-2 py-1 text-xs"
            >
              <option value="">{t('admin.chat.all_providers')}</option>
              <option value="claude">Claude</option>
              <option value="openai">OpenAI</option>
              <option value="gemini">Gemini</option>
            </select>
          </div>

          {/* Session list */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                {showArchived ? t('admin.chat.no_archived_sessions') : t('admin.chat.no_sessions')}
              </div>
            ) : (
              <div className="divide-y">
                {sessions.map(s => (
                  <div
                    key={s.id}
                    className={`flex items-start gap-2 px-4 py-3 cursor-pointer hover:bg-accent transition-colors ${
                      selectedId === s.id ? 'bg-accent' : ''
                    } ${s.archived ? 'opacity-60' : ''}`}
                  >
                    {/* Clickable area */}
                    <div
                      className="flex-1 min-w-0"
                      onClick={() => setSelectedId(s.id)}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium">
                          {s.title ?? t('admin.chat.no_title')}
                        </span>
                        {!!s.archived && (
                          <Badge variant="secondary" className="shrink-0 text-xs">{t('admin.chat.badge_archived')}</Badge>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {s.user_name} · {s.provider}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(s.updated_at).toLocaleString(i18n.language)}
                      </div>
                    </div>
                    {/* Quick actions — kept outside clickable area */}
                    <div className="flex shrink-0 flex-col gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        title={s.archived ? t('admin.chat.btn_unarchive') : t('admin.chat.btn_archive')}
                        onClick={e => void toggleArchive(s, e)}
                        disabled={savingId === s.id}
                      >
                        {savingId === s.id
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : s.archived
                            ? <ArchiveX className="h-3 w-3 text-amber-600" />
                            : <Archive className="h-3 w-3 text-muted-foreground" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        title={t('admin.chat.btn_delete_forever')}
                        onClick={() => setDeleteId(s.id)}
                        disabled={savingId === s.id}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex shrink-0 items-center justify-center gap-2 border-t px-4 py-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="rounded px-2 py-1 text-xs hover:bg-accent disabled:opacity-40"
              >
                {t('common.prev_page')}
              </button>
              <span className="text-xs text-muted-foreground">{page} / {totalPages}</span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
                className="rounded px-2 py-1 text-xs hover:bg-accent disabled:opacity-40"
              >
                {t('common.next_page')}
              </button>
            </div>
          )}
        </div>

        {/* ── Right: session detail ── */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {selectedId ? (
            <SessionDetail
              key={selectedId}
              sessionId={selectedId}
              onBack={() => setSelectedId(null)}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
              <MessageSquare className="h-10 w-10 opacity-20" />
              <p className="text-sm">{t('admin.chat.select_session_hint', { defaultValue: 'Click a conversation on the left to view details' })}</p>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={open => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.chat.dialog_delete_title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.chat.dialog_delete_desc', { title: deleteTarget?.title ?? t('admin.chat.no_title') })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleDelete()}
              disabled={deleteLoading}
            >
              {deleteLoading && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {t('admin.chat.btn_delete_forever')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
