import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, ToggleLeft, ToggleRight, ChevronDown, ChevronRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface RoleMapping {
  id: string;
  provider_id: string;
  claim_path: string;
  claim_value: string;
  zenku_role: 'admin' | 'builder' | 'user';
}

const ZENKU_ROLES = ['admin', 'builder', 'user'] as const;

interface OidcProviderRow {
  id: string;
  name: string;
  issuer: string;
  client_id: string;
  client_secret: string;
  enabled: number;
  created_at: string;
}

interface FormState {
  name: string;
  issuer: string;
  client_id: string;
  client_secret: string;
}

const EMPTY_FORM: FormState = { name: '', issuer: '', client_id: '', client_secret: '' };

interface ProviderRowProps {
  provider: OidcProviderRow;
  token: string;
  onToggle: () => void;
  onDelete: () => void;
}

function ProviderRow({ provider: p, token, onToggle, onDelete }: ProviderRowProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [mappings, setMappings] = useState<RoleMapping[]>([]);
  const [loadingMappings, setLoadingMappings] = useState(false);
  const [showAddMapping, setShowAddMapping] = useState(false);
  const [claimPath, setClaimPath] = useState('');
  const [claimValue, setClaimValue] = useState('');
  const [zenkuRole, setZenkuRole] = useState<'admin' | 'builder' | 'user'>('user');
  const [savingMapping, setSavingMapping] = useState(false);

  const loadMappings = useCallback(async () => {
    setLoadingMappings(true);
    try {
      const res = await fetch(`/api/admin/oidc-providers/${p.id}/role-mappings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setMappings(await res.json() as RoleMapping[]);
    } finally {
      setLoadingMappings(false);
    }
  }, [p.id, token]);

  const handleExpand = () => {
    if (!expanded) void loadMappings();
    setExpanded(e => !e);
  };

  const handleAddMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimPath.trim() || !claimValue.trim()) return;
    setSavingMapping(true);
    try {
      await fetch(`/api/admin/oidc-providers/${p.id}/role-mappings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ claim_path: claimPath.trim(), claim_value: claimValue.trim(), zenku_role: zenkuRole }),
      });
      setClaimPath(''); setClaimValue(''); setZenkuRole('user'); setShowAddMapping(false);
      void loadMappings();
    } finally {
      setSavingMapping(false);
    }
  };

  const handleDeleteMapping = async (id: string) => {
    await fetch(`/api/admin/oidc-role-mappings/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    void loadMappings();
  };

  return (
    <div className="rounded-lg border bg-card">
      {/* Provider header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button type="button" onClick={handleExpand} className="text-muted-foreground hover:text-foreground">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{p.name}</span>
            {p.enabled === 0 && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{t('oidc.disabled')}</span>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">{p.issuer}</p>
        </div>
        <button type="button" onClick={onToggle} className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground" title={p.enabled === 1 ? t('oidc.disable') : t('oidc.enable')}>
          {p.enabled === 1 ? <ToggleRight size={18} className="text-primary" /> : <ToggleLeft size={18} />}
        </button>
        <button type="button" onClick={onDelete} className="rounded-md p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive">
          <Trash2 size={14} />
        </button>
      </div>

      {/* Role mappings section */}
      {expanded && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">{t('oidc.role_mappings')}</p>
            <button type="button" onClick={() => setShowAddMapping(s => !s)} className="flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium text-primary hover:bg-primary/10">
              <Plus size={11} />{t('oidc.add_mapping')}
            </button>
          </div>

          {showAddMapping && (
            <form onSubmit={(e) => { void handleAddMapping(e); }} className="rounded-md border bg-muted/30 p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium">{t('oidc.mapping_claim_path')}</label>
                  <input value={claimPath} onChange={e => setClaimPath(e.target.value)} placeholder="realm_access.roles" className="mt-1 w-full rounded border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-xs font-medium">{t('oidc.mapping_claim_value')}</label>
                  <input value={claimValue} onChange={e => setClaimValue(e.target.value)} placeholder="admin" className="mt-1 w-full rounded border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium">{t('oidc.mapping_zenku_role')}</label>
                <select value={zenkuRole} onChange={e => setZenkuRole(e.target.value as typeof zenkuRole)} className="mt-1 w-full rounded border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary">
                  {ZENKU_ROLES.map(r => <option key={r} value={r}>{t(`admin.roles.${r}`)}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={savingMapping || !claimPath.trim() || !claimValue.trim()} className="rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50">
                  {t('common.save')}
                </button>
                <button type="button" onClick={() => setShowAddMapping(false)} className="rounded border px-3 py-1 text-xs">{t('common.cancel')}</button>
              </div>
            </form>
          )}

          {loadingMappings ? (
            <p className="text-xs text-muted-foreground">{t('common.loading')}</p>
          ) : mappings.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('oidc.no_mappings')}</p>
          ) : (
            <div className="space-y-1.5">
              {mappings.map(m => (
                <div key={m.id} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                  <code className="flex-1 font-mono text-muted-foreground">{m.claim_path} = <span className="text-foreground">{m.claim_value}</span></code>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-medium">{t(`admin.roles.${m.zenku_role}`)}</span>
                  <button type="button" onClick={() => { void handleDeleteMapping(m.id); }} className="ml-1 text-muted-foreground hover:text-destructive">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground">{t('oidc.mapping_hint')}</p>
        </div>
      )}
    </div>
  );
}

export function OidcManagement() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [providers, setProviders] = useState<OidcProviderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [authMode, setAuthMode] = useState<'local' | 'sso_only'>('local');
  const [savingMode, setSavingMode] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [provRes, settingsRes] = await Promise.all([
        fetch('/api/admin/oidc-providers', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/settings', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (provRes.ok) setProviders(await provRes.json() as OidcProviderRow[]);
      if (settingsRes.ok) {
        const s = await settingsRes.json() as { auth_mode: string };
        setAuthMode(s.auth_mode === 'sso_only' ? 'sso_only' : 'local');
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim() || !form.issuer.trim() || !form.client_id.trim() || !form.client_secret.trim()) {
      setError(t('errors.ERROR_MISSING_FIELDS'));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/oidc-providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setError(d.error ?? t('common.error'));
        return;
      }
      setForm(EMPTY_FORM);
      setShowForm(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const toggleAuthMode = async () => {
    const next = authMode === 'sso_only' ? 'local' : 'sso_only';
    setSavingMode(true);
    try {
      await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ auth_mode: next }),
      });
      setAuthMode(next);
    } finally {
      setSavingMode(false);
    }
  };

  const toggleEnabled = async (p: OidcProviderRow) => {
    await fetch(`/api/admin/oidc-providers/${p.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ enabled: p.enabled === 1 ? 0 : 1 }),
    });
    await load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('oidc.confirm_delete'))) return;
    await fetch(`/api/admin/oidc-providers/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    await load();
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b px-6 py-4">
        <div>
          <h2 className="text-base font-semibold">{t('oidc.title')}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{t('oidc.desc')}</p>
        </div>
        <button
          type="button"
          onClick={() => { setShowForm(f => !f); setError(''); }}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:bg-primary/90"
        >
          <Plus size={13} />
          {t('oidc.add_provider')}
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">

      {showForm && (
        <form onSubmit={(e) => { void handleAdd(e); }} className="rounded-lg border bg-muted/30 p-4 space-y-3">
          <h3 className="text-sm font-medium">{t('oidc.add_provider')}</h3>
          {[
            { key: 'name', label: t('oidc.field_name'), placeholder: 'Google' },
            { key: 'issuer', label: t('oidc.field_issuer'), placeholder: 'https://accounts.google.com' },
            { key: 'client_id', label: t('oidc.field_client_id'), placeholder: '' },
            { key: 'client_secret', label: t('oidc.field_client_secret'), placeholder: '' },
          ].map(({ key, label, placeholder }) => (
            <div key={key} className="space-y-1">
              <label className="text-xs font-medium">{label}</label>
              <input
                type={key === 'client_secret' ? 'password' : 'text'}
                value={form[key as keyof FormState]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          ))}
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? t('common.saving') : t('common.save')}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setError(''); }}
              className="rounded-md border px-3 py-1.5 text-xs font-medium transition hover:bg-muted"
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      ) : providers.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">{t('oidc.no_providers')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {providers.map(p => (
            <ProviderRow key={p.id} provider={p} token={token} onToggle={() => { void toggleEnabled(p); }} onDelete={() => { void handleDelete(p.id); }} />
          ))}
        </div>
      )}

      {/* SSO-only toggle */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{t('oidc.sso_only_label')}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{t('oidc.sso_only_desc')}</p>
          </div>
          <button
            type="button"
            onClick={() => { void toggleAuthMode(); }}
            disabled={savingMode || providers.filter(p => p.enabled === 1).length === 0}
            className="disabled:opacity-40"
            title={providers.filter(p => p.enabled === 1).length === 0 ? t('oidc.sso_only_requires_provider') : undefined}
          >
            {authMode === 'sso_only'
              ? <ToggleRight size={28} className="text-primary" />
              : <ToggleLeft size={28} className="text-muted-foreground" />}
          </button>
        </div>
        {authMode === 'sso_only' && (
          <p className="mt-2 rounded-md bg-amber-50 px-3 py-1.5 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
            {t('oidc.sso_only_warning')}
          </p>
        )}
      </div>

      <div className="rounded-lg border bg-muted/30 p-4 text-xs text-muted-foreground space-y-1">
        <p className="font-medium">{t('oidc.callback_url_label')}</p>
        <code className="block rounded bg-muted px-2 py-1 font-mono">
          {window.location.origin}/api/auth/oidc/callback
        </code>
        <p>{t('oidc.callback_url_hint')}</p>
      </div>

      </div> {/* end scrollable content */}
    </div>
  );
}
