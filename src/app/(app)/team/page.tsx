import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/current-user';
import { listOrgMembers } from '@/lib/queries/team';
import { TeamPanel } from '@/components/team/team-panel';

export default async function TeamPage() {
  const session = await requireSession();
  const t = await getTranslations();

  if (!['clinic_admin', 'lab_admin'].includes(session.profile.role)) {
    redirect('/dashboard');
  }

  const members = await listOrgMembers(session.organization.id);
  const orgType = session.organization.type;
  const doctors = members.filter((m) => m.role === 'doctor' && m.is_active);

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-2xl font-bold text-ink">{t('nav.team')}</h1>
      <TeamPanel
        orgType={orgType}
        members={members}
        currentUserId={session.profile.id}
        doctors={doctors.map((d) => ({ id: d.id, name: d.full_name }))}
      />
    </div>
  );
}
