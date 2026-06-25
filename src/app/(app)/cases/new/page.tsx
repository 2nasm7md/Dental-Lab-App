import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentSession } from '@/lib/current-user';
import { sideOfOrgType } from '@/lib/case-state-machine';
import { listActivePartners, listClinicDoctors } from '@/lib/queries/connections';
import { CaseForm } from '@/components/cases/case-form';

export default async function NewCasePage() {
  const session = (await getCurrentSession())!;
  const t = await getTranslations();
  const side = sideOfOrgType(session.organization!.type);
  if (side !== 'clinic') redirect('/dashboard');

  const [labs, doctors] = await Promise.all([
    listActivePartners(session.organization!.id, 'clinic'),
    listClinicDoctors(session.organization!.id),
  ]);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-ink">{t('nav.newCase')}</h1>
      <CaseForm
        labs={labs.map((p) => ({ id: p.org.id, name: p.org.name }))}
        doctors={doctors.map((d) => ({ id: d.id, name: d.full_name }))}
        currentUserId={session.profile!.id}
        currentRole={session.profile!.role!}
      />
    </div>
  );
}
