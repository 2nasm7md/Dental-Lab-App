import { notFound } from 'next/navigation';
import { createSupabaseAnonClient } from '@/lib/supabase/anon';
import type { Doctor, Tenant, VisitType } from '@/lib/types/db';
import { BookingWizard } from './booking-wizard';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function BookingPage(props: Props) {
  const { slug } = await props.params;
  const supabase = createSupabaseAnonClient();
  const { data: tenant } = await supabase
    .from('tenants')
    .select('*')
    .eq('slug', slug)
    .eq('public', true)
    .single();
  if (!tenant) notFound();
  const tenantId = (tenant as Tenant).id;

  const [{ data: doctors }, { data: visitTypes }] = await Promise.all([
    supabase
      .from('doctors')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .order('name'),
    supabase
      .from('visit_types')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .order('name'),
  ]);

  return (
    <main className="container py-10">
      <BookingWizard
        slug={slug}
        doctors={(doctors ?? []) as Doctor[]}
        visitTypes={(visitTypes ?? []) as VisitType[]}
      />
    </main>
  );
}
