'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  LayoutDashboard,
  ClipboardList,
  PlusCircle,
  Building2,
  Settings,
  Bell,
  LogOut,
  Globe,
  Wallet,
  Users,
} from 'lucide-react';
import type { CurrentSession } from '@/lib/current-user';
import { cn, initials } from '@/lib/utils';
import { signOutAction, toggleLocaleAction } from '@/server/actions/auth';
import { sideOfOrgType } from '@/lib/case-state-machine';
import { useLocale } from 'next-intl';

interface NavItem {
  href: string;
  labelKey: string;
  icon: React.ReactNode;
}

function buildNav(
  side: 'clinic' | 'lab',
  costTracking: boolean,
  isAdmin: boolean
): NavItem[] {
  return [
    { href: '/dashboard', labelKey: 'nav.dashboard', icon: <LayoutDashboard className="size-5" /> },
    { href: '/cases', labelKey: 'nav.cases', icon: <ClipboardList className="size-5" /> },
    ...(side === 'clinic'
      ? [{ href: '/cases/new', labelKey: 'nav.newCase', icon: <PlusCircle className="size-5" /> }]
      : []),
    {
      href: '/connections',
      labelKey: side === 'clinic' ? 'nav.labs' : 'nav.clinics',
      icon: <Building2 className="size-5" />,
    },
    ...(isAdmin
      ? [{ href: '/team', labelKey: 'nav.team', icon: <Users className="size-5" /> }]
      : []),
    ...(costTracking
      ? [{ href: '/billing', labelKey: 'nav.billing', icon: <Wallet className="size-5" /> }]
      : []),
    { href: '/notifications', labelKey: 'nav.notifications', icon: <Bell className="size-5" /> },
    { href: '/settings', labelKey: 'nav.settings', icon: <Settings className="size-5" /> },
  ];
}

export function AppShell({
  session,
  children,
  notificationsSlot,
}: {
  session: CurrentSession;
  children: React.ReactNode;
  notificationsSlot?: React.ReactNode;
}) {
  const t = useTranslations();
  const pathname = usePathname();
  const locale = useLocale();
  const side = session.organization
    ? sideOfOrgType(session.organization.type)
    : 'clinic';
  const costTracking =
    (session.organization?.settings as { cost_tracking_enabled?: boolean })
      ?.cost_tracking_enabled !== false;
  const isAdmin =
    session.profile?.role === 'clinic_admin' || session.profile?.role === 'lab_admin';
  const items = buildNav(side, costTracking, isAdmin);

  return (
    <div className="min-h-screen flex bg-surface-muted">
      <aside className="hidden md:flex md:flex-col w-64 bg-white border-e border-surface-border">
        <div className="px-6 py-5 border-b border-surface-border flex items-center gap-2">
          <div className="size-9 rounded-xl bg-brand-600 text-white grid place-items-center font-bold">
            D
          </div>
          <div className="leading-tight">
            <div className="font-semibold text-ink">{session.organization?.name}</div>
            <div className="text-xs text-ink-subtle">
              {t(`roles.${session.profile!.role!}`)}
            </div>
          </div>
        </div>
        <nav className="p-3 flex-1">
          {items.map((it) => {
            const active = pathname === it.href || pathname?.startsWith(it.href + '/');
            return (
              <Link
                key={it.href}
                href={it.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium',
                  active
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-ink-muted hover:bg-surface-muted hover:text-ink'
                )}
              >
                {it.icon}
                <span>{t(it.labelKey)}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-surface-border space-y-2">
          <form action={toggleLocaleAction}>
            <button className="btn-ghost w-full justify-start" type="submit">
              <Globe className="size-4" />
              {locale === 'ar' ? t('settings.english') : t('settings.arabic')}
            </button>
          </form>
          <form action={signOutAction}>
            <button className="btn-ghost w-full justify-start" type="submit">
              <LogOut className="size-4" />
              {t('nav.logout')}
            </button>
          </form>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-surface-border px-4 md:px-8 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 md:hidden">
            <div className="size-8 rounded-xl bg-brand-600 text-white grid place-items-center font-bold">
              D
            </div>
            <div className="font-semibold text-ink truncate">
              {session.organization?.name}
            </div>
          </div>
          <div className="hidden md:block font-semibold text-ink-muted">
            {session.profile?.full_name}
          </div>
          <div className="flex items-center gap-3">
            {notificationsSlot}
            <div className="size-9 rounded-full bg-brand-100 text-brand-800 grid place-items-center text-sm font-semibold">
              {initials(session.profile?.full_name ?? '')}
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8 min-w-0">{children}</main>
        <nav className="md:hidden bg-white border-t border-surface-border px-2 py-1.5 flex justify-around sticky bottom-0">
          {items.slice(0, 5).map((it) => {
            const active = pathname === it.href || pathname?.startsWith(it.href + '/');
            return (
              <Link
                key={it.href}
                href={it.href}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-[10px]',
                  active ? 'text-brand-700' : 'text-ink-subtle'
                )}
              >
                {it.icon}
                <span>{t(it.labelKey)}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
