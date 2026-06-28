'use client';

import { useTransition } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun, LogOut, Languages } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { initials } from '@/lib/utils';
import { logoutAction } from '@/server/actions/auth';

interface Props {
  email: string;
  fullName: string | null;
  role: string;
}

export function Topbar({ email, fullName, role }: Props) {
  const { setTheme, theme } = useTheme();
  const [pending, start] = useTransition();
  const t = useTranslations('auth');

  function toggleLocale() {
    const next = document.documentElement.lang === 'ar' ? 'en' : 'ar';
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=${60 * 60 * 24 * 365}`;
    window.location.reload();
  }

  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-4">
      <div />
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={toggleLocale} aria-label="Toggle language">
          <Languages className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle theme"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          <Sun className="h-4 w-4 dark:hidden" />
          <Moon className="hidden h-4 w-4 dark:inline" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2">
              <Avatar className="h-7 w-7">
                <AvatarFallback>{initials(fullName ?? email)}</AvatarFallback>
              </Avatar>
              <span className="hidden text-sm md:inline">{fullName ?? email}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>
              <div className="text-sm font-semibold">{fullName ?? email}</div>
              <div className="text-xs text-muted-foreground">{role}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={pending}
              onSelect={() => start(() => logoutAction())}
            >
              <LogOut className="me-2 h-4 w-4" />
              {t('logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
