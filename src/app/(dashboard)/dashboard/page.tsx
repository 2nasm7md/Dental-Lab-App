import { getTranslations } from 'next-intl/server';
import { Calendar, CheckCircle2, Users, XCircle } from 'lucide-react';
import { requireOnboarded } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateTime } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { Appointment } from '@/lib/types/db';

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}
function plusDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export default async function DashboardHome() {
  await requireOnboarded();
  const supabase = await createSupabaseServerClient();
  const t = await getTranslations('dashboard');
  const tAppt = await getTranslations('appointments');

  const [{ count: todayCount }, { count: weekCount }, { count: doctors }, { count: noShows }, { count: total }, recent] =
    await Promise.all([
      supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .gte('start_at', startOfToday())
        .lte('start_at', endOfToday())
        .in('status', ['confirmed', 'completed']),
      supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .gte('start_at', startOfToday())
        .lte('start_at', plusDays(7))
        .in('status', ['confirmed', 'completed']),
      supabase.from('doctors').select('id', { count: 'exact', head: true }).eq('active', true),
      supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'no_show')
        .gte('start_at', plusDays(-30)),
      supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .gte('start_at', plusDays(-30)),
      supabase
        .from('appointments')
        .select('*')
        .gte('start_at', startOfToday())
        .order('start_at', { ascending: true })
        .limit(8),
    ]);

  const noShowRate =
    total && total > 0 ? Math.round(((noShows ?? 0) / total) * 100) : 0;

  const stats = [
    { icon: Calendar,    label: t('appointments_today'), value: todayCount ?? 0 },
    { icon: CheckCircle2, label: t('upcoming_week'),     value: weekCount ?? 0 },
    { icon: Users,       label: t('active_doctors'),     value: doctors ?? 0 },
    { icon: XCircle,     label: t('no_show_rate'),       value: `${noShowRate}%` },
  ];

  const upcoming = (recent.data ?? []) as Appointment[];

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ icon: Icon, label, value }) => (
          <Card key={label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="mt-1 text-2xl font-bold">{value}</p>
                </div>
                <div className="rounded-md bg-primary/10 p-2 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{tAppt('title')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {upcoming.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">{tAppt('empty')}</p>
          ) : (
            <ul className="divide-y">
              {upcoming.map((a) => (
                <li key={a.id} className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium">{a.patient_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(a.start_at)} · {a.patient_phone}
                    </p>
                  </div>
                  <StatusBadge status={a.status} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: Appointment['status'] }) {
  const variant =
    status === 'confirmed'
      ? 'default'
      : status === 'completed'
        ? 'success'
        : status === 'no_show'
          ? 'warning'
          : 'destructive';
  return <Badge variant={variant}>{status}</Badge>;
}
