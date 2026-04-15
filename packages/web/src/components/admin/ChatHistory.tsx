import { useEffect, useState } from 'react';
import { X, ChevronRight, RefreshCw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { SessionDetail } from './SessionDetail';

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
}

interface Props {
  onClose: () => void;
}

export function ChatHistory({ onClose }: Props) {
  const { token } = useAuth();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [filterProvider, setFilterProvider] = useState('');

  const fetch_ = async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (filterProvider) params.set('provider', filterProvider);
    const res = await fetch(`/api/admin/sessions?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json() as { sessions: SessionRow[]; total: number };
      setSessions(data.sessions);
      setTotal(data.total);
    }
    setLoading(false);
  };

  useEffect(() => { void fetch_(); }, [page, filterProvider]);

  if (selectedSession) {
    return <SessionDetail sessionId={selectedSession} onBack={() => setSelectedSession(null)} onClose={onClose} />;
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex w-full max-w-4xl flex-col overflow-hidden rounded-xl border bg-background shadow-xl" style={{ maxHeight: '85vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-base font-semibold">對話歷程</h2>
            <p className="text-xs text-muted-foreground">共 {total} 筆 session</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={filterProvider}
              onChange={e => { setPage(1); setFilterProvider(e.target.value); }}
              className="rounded border bg-background px-2 py-1 text-xs"
            >
              <option value="">所有 Provider</option>
              <option value="claude">Claude</option>
              <option value="openai">OpenAI</option>
              <option value="gemini">Gemini</option>
            </select>
            <button
              onClick={() => void fetch_()}
              className="rounded-md p-1.5 hover:bg-accent"
              title="重新整理"
            >
              <RefreshCw size={14} />
            </button>
            <button onClick={onClose} className="rounded-md p-1 hover:bg-accent">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">尚無對話紀錄</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 border-b bg-muted/80 backdrop-blur">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">標題 / 時間</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">使用者</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Provider</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">訊息數</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Tokens</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">費用</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {sessions.map(s => (
                  <tr
                    key={s.id}
                    className="cursor-pointer hover:bg-muted/30"
                    onClick={() => setSelectedSession(s.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="max-w-xs truncate font-medium">
                        {s.title ?? '（無標題）'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(s.updated_at).toLocaleString('zh-TW')}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{s.user_name}</div>
                      <div className="text-xs text-muted-foreground">{s.user_email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs">
                        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
                          {s.provider}
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{s.model}</div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{s.message_count}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {(s.total_input_tokens + s.total_output_tokens).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-xs">
                      ${s.total_cost_usd.toFixed(4)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <ChevronRight size={14} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 border-t px-6 py-3">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="rounded px-3 py-1 text-sm hover:bg-accent disabled:opacity-40"
            >
              上一頁
            </button>
            <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="rounded px-3 py-1 text-sm hover:bg-accent disabled:opacity-40"
            >
              下一頁
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
