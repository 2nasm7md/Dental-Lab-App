'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Calendar,
  Image as ImageIcon,
  LayoutDashboard,
  Settings,
  Stethoscope,
  Users,
  Workflow,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/dashboard',    key: 'dashboard',    icon: LayoutDashboard },
  { href: '/doctors',      key: 'doctors',      icon: Users },
  { href: '/visit-types',  key: 'visit_types',  icon: Stethoscope },
  { href: '/schedules',    key: 'schedules',    icon: Workflow },
  { href: '/appointments', key: 'appointments', icon: Calendar },
  { href: '/portfolio',    key: 'portfolio',    icon: ImageIcon },
  { href: '/settings',     key: 'settings',     icon: Settings },
] as const;

export function Sidebar({ tenantName, tenantSlug }: { tenantName: string; tenantSlug: string }) {
  const pathname = usePathname();
  const t = useTranslations('nav');
  const tApp = useTranslations('app');

  return (
    <aside className="hidden border-e bg-card md:flex md:w-60 md:flex-col">
      <div className="flex items-center gap-2 px-4 py-5 border-b">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold">
          D
        </span>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold truncate">{tenantName}</span>
          <span className="text-xs text-muted-foreground">{tApp('name')}</span>
        </div>
      </div>
      <nav className="flex-1 px-2 py-3 space-y-1">
        {NAV.map(({ href, key, icon: Icon }) => {
          const active = pathname?.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{t(key)}</span>
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-2">
        <Link
          href={`/c/${tenantSlug}`}
          target="_blank"
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <ExternalLink className="h-4 w-4" />
          {t('view_site')}
        </Link>
      </div>
    </aside>
  );
}
