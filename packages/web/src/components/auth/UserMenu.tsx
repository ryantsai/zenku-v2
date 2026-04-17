import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LogOut, ChevronUp, Settings } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { AdminPanel } from '../admin/AdminPanel';
import type { AdminTab } from '../admin/AdminPanel';
import { ProfileDialog } from './ProfileDialog';

export function UserMenu() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [adminTab, setAdminTab] = useState<AdminTab | null>(null);
  const [showProfile, setShowProfile] = useState(false);

  const openAdmin = (tab: AdminTab) => {
    setAdminTab(tab);
    setOpen(false);
  };

  return (
    <>
      <div className="relative border-t p-2">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
        >
          {/* Avatar */}
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            {user.name[0]?.toUpperCase()}
          </div>
          <div className="flex-1 overflow-hidden text-left">
            <div className="truncate font-medium text-foreground">{user.name}</div>
            <div className="text-xs text-muted-foreground">{t(`admin.roles.${user.role}`, { defaultValue: user.role })}</div>
          </div>
          <ChevronUp
            size={14}
            className={`shrink-0 text-muted-foreground transition-transform ${open ? '' : 'rotate-180'}`}
          />
        </button>

        {open && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            {/* Menu */}
            <div className="absolute bottom-full left-2 right-2 z-20 mb-1 overflow-hidden rounded-md border bg-popover shadow-md">
              <div className="px-3 py-2 text-xs text-muted-foreground border-b">
                {user.email}
              </div>
              {user.role === 'admin' && (
                <button
                  onClick={() => openAdmin('users')}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
                >
                  <Settings size={14} />
                  {t('admin.panel.title', { defaultValue: '系統設定' })}
                </button>
              )}
              <button
                onClick={() => { setShowProfile(true); setOpen(false); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
              >
                <Settings size={14} />
                {t('profile.title')}
              </button>
              <button
                onClick={() => { logout(); setOpen(false); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
              >
                <LogOut size={14} />
                {t('common.logout')}
              </button>
            </div>
          </>
        )}
      </div>

      {adminTab !== null && (
        <AdminPanel
          initialTab={adminTab}
          onClose={() => setAdminTab(null)}
        />
      )}
      <ProfileDialog open={showProfile} onClose={() => setShowProfile(false)} />
    </>
  );
}
