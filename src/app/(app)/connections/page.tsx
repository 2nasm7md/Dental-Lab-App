import { getTranslations } from 'next-intl/server';
import { Building2, Search, UserPlus } from 'lucide-react';
import { getCurrentSession } from '@/lib/current-user';
import { sideOfOrgType } from '@/lib/case-state-machine';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  listActivePartners,
  listPendingConnections,
  listOutgoingPending,
} from '@/lib/queries/connections';
import { EmptyState } from '@/components/ui/empty-state';
import { ConnectionsActions } from '@/components/connections/connections-actions';
import { ConnectionsDirectory } from '@/components/connections/connections-directory';

export default async function ConnectionsPage() {
  const session = (await getCurrentSession())!;
  const t = await getTranslations();
  const side = sideOfOrgType(session.organization!.type);

  const [partners, pending, outgoing, directory] = await Promise.all([
    listActivePartners(session.organization!.id, side),
    // Only labs need to "respond" to pending; clinics initiate.
    side === 'lab'
      ? listPendingConnections(session.organization!.id, side)
      : Promise.resolve([] as Awaited<ReturnType<typeof listPendingConnections>>),
    listOutgoingPending(session.organization!.id, side),
    fetchDirectory(side === 'clinic' ? 'lab' : 'clinic'),
  ]);

  const linkedIds = new Set(partners.map((p) => p.org.id));
  const pendingIds = new Set([
    ...pending.map((p) => p.partner.id),
    ...outgoing,
  ]);

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
              <ConnectionsActions.PendingRow key={p.id} row={p} />
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
          linkedIds={Array.from(linkedIds)}
          pendingIds={Array.from(pendingIds)}
        />
      </section>

      <section className="card p-5">
        <div className="flex items-center gap-2 mb-3">
          <UserPlus className="size-5 text-brand-600" />
          <h2 className="font-semibold text-ink">
            {t('connections.inviteOffPlatform')}
          </h2>
        </div>
        <ConnectionsActions.Invite invitedType={side === 'clinic' ? 'lab' : 'clinic'} />
      </section>
    </div>
  );
}

async function fetchDirectory(type: 'clinic' | 'lab') {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from('organizations')
    .select('id, name, type, phone, email, logo_url')
    .eq('type', type)
    .is('deleted_at', null)
    .order('name')
    .limit(50);
  return (data ?? []) as Array<{
    id: string;
    name: string;
    type: 'clinic' | 'lab';
    phone: string | null;
    email: string | null;
    logo_url: string | null;
  }>;
}
