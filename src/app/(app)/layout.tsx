import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/lib/current-user';
import { AppShell } from '@/components/layout/app-shell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();
  if (!session) redirect('/login');
  if (!session.profile?.organization_id || !session.profile?.role) {
    redirect('/onboarding');
  }
  return <AppShell session={session}>{children}</AppShell>;
}
