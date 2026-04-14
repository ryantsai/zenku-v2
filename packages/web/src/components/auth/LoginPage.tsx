import { useState } from 'react';
import type { AuthUser } from '../../contexts/AuthContext';

interface Props {
  hasUsers: boolean;
  onAuth: (user: AuthUser, token: string) => void;
}

interface AuthResponse {
  token: string;
  user: AuthUser;
  error?: string;
}

export function LoginPage({ hasUsers, onAuth }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>(hasUsers ? 'login' : 'register');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body = mode === 'login' ? { email, password } : { email, name, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json() as AuthResponse;

      if (!res.ok) {
        setError(data.error ?? '操作失敗');
        return;
      }

      onAuth(data.user, data.token);
    } catch {
      setError('網路錯誤，請重試');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-xl font-bold text-primary-foreground">
            Z
          </div>
          <h1 className="text-2xl font-bold">Zenku</h1>
          <p className="text-sm text-muted-foreground">
            {mode === 'login' ? '登入你的帳號' : !hasUsers ? '建立第一個管理員帳號' : '建立新帳號'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={(e) => { void submit(e); }} className="space-y-4">
          {mode === 'register' && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">姓名</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="你的名字"
                required
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              autoComplete="email"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">密碼</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="至少 6 個字元"
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? '處理中…' : mode === 'login' ? '登入' : '建立帳號'}
          </button>
        </form>

        {/* Toggle */}
        {hasUsers && (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {mode === 'login' ? '還沒有帳號？' : '已有帳號？'}
            <button
              type="button"
              onClick={() => { setMode(m => m === 'login' ? 'register' : 'login'); setError(''); }}
              className="ml-1 font-medium text-primary hover:underline"
            >
              {mode === 'login' ? '註冊' : '登入'}
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
