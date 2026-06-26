import { getTranslations } from 'next-intl/server';
import { Building2, Search, UserPlus } from 'lucide-react';
import { requireSession } from '@/lib/current-user';
import { sideOfOrgType } from '@/lib/case-state-machine';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  listActivePartners,
  listPendingConnections,
  listOutgoingPending,
} from '@/lib/queries/connections';
import { EmptyState } from '@/components/ui/empty-state';
import { PendingRow, Invite } from '@/components/connections/connections-actions';
import { ConnectionsDirectory } from '@/components/connections/connections-directory';

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const session = await requireSession();
  const t = await getTranslations();
  const side = sideOfOrgType(session.organization.type);
  const q = (searchParams.q ?? '').trim();

  const partners = await listActivePartners(session.organization.id, side);
  const pending = side === 'lab'
    ? await listPendingConnections(session.organization.id, side)
    : [];
  const outgoing = await listOutgoingPending(session.organization.id, side);
  const directory = await fetchDirectory(
    side === 'clinic' ? 'lab' : 'clinic',
    q,
    session.organization.id
  );

  const linkedIds = Array.from(new Set(partners.map((p) => p.org.id)));
  const pendingIds = Array.from(
    new Set([...pending.map((p) => p.partner.id), ...outgoing])
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ink">
        {side === 'clinic' ? t('connections.myLabs') : t('connections.myClinics')}
      </h1>

      {pending.length > 0 ? (
        <section className="card p-5">
          <h2 className="font-semibold text-ink mb-3">
            {t('connections.incomingRequests')}
          </h2>
          <div className="space-y-2">
            {pending.map((p) => (
              <PendingRow key={p.id} row={p} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-semibold text-ink">
          {side === 'clinic' ? t('connections.myLabs') : t('connections.myClinics')}
        </h2>
        {partners.length === 0 ? (
          <EmptyState
            icon={<Building2 className="size-8" />}
            title={
              side === 'clinic' ? t('connections.noLabs') : t('connections.noClinics')
            }
            description={t('connections.directory')}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {partners.map((p) => (
              <div key={p.connection_id} className="card p-4">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-brand-50 text-brand-700 grid place-items-center">
                    <Building2 className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-ink truncate">
                      {p.org.name}
                    </div>
                    {p.org.phone ? (
                      <div className="text-xs text-ink-subtle truncate">
                        {p.org.phone}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-ink flex items-center gap-2">
          <Search className="size-5" />
          {side === 'clinic'
            ? t('connections.directory')
            : t('connections.directoryClinics')}
        </h2>
        <ConnectionsDirectory
          orgs={directory}
          linkedIds={linkedIds}
          pendingIds={pendingIds}
          initialQuery={q}
          ownOrgId={session.organization.id}
        />
      </section>

      <section className="card p-5">
        <div className="flex items-center gap-2 mb-3">
          <UserPlus className="size-5 text-brand-600" />
          <h2 className="font-semibold text-ink">
            {t('connections.inviteOffPlatform')}
          </h2>
        </div>
        <Invite invitedType={side === 'clinic' ? 'lab' : 'clinic'} />
      </section>
    </div>
  );
}

async function fetchDirectory(
  type: 'clinic' | 'lab',
  q: string,
  ownOrgId: string
) {
  const supabase = createSupabaseServerClient();
  let query = supabase
    .from('organizations')
    .select('id, name, type, phone, email, logo_url')
    .eq('type', type)
    .is('deleted_at', null)
    .neq('id', ownOrgId)
    .order('name')
    .limit(50);
  if (q) {
    const safe = q.replace(/[%(),:]/g, '');
    query = query.or(`name.ilike.%${safe}%,phone.ilike.%${safe}%`);
  }
  const { data, error } = await query;
  if (error) {
    console.error('[connections:fetchDirectory] supabase error', {
      message: error.message,
      code: (error as { code?: string }).code,
      details: (error as { details?: string }).details,
      hint: (error as { hint?: string }).hint,
    });
    return [];
  }
  return (data ?? []) as Array<{
    id: string;
    name: string;
    type: 'clinic' | 'lab';
    phone: string | null;
    email: string | null;
    logo_url: string | null;
  }>;
}
