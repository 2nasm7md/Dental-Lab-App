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
import { ConnectionsActions } from '@/components/connections/connections-actions';
import { ConnectionsDirectory } from '@/components/connections/connections-directory';

async function step<T>(label: string, run: () => Promise<T>): Promise<T> {
  try {
    const v = await run();
    console.log(
      `[connections:${label}] ok`,
      Array.isArray(v) ? `rows=${v.length}` : typeof v
    );
    return v;
  } catch (e) {
    const err = e as Error & { code?: string; details?: string; hint?: string };
    console.error(`[connections:${label}] failed`, {
      name: err?.name,
      message: err?.message,
      code: err?.code,
      details: err?.details,
      hint: err?.hint,
      stack: err?.stack,
    });
    const wrapped = new Error(`[connections:${label}] ${err?.message ?? String(e)}`);
    (wrapped as Error & { cause?: unknown }).cause = e;
    throw wrapped;
  }
}

// Auth/redirect happens OUTSIDE the try block so NEXT_REDIRECT propagates.
// Everything else runs inside, so a thrown error is caught and rendered
// inline (gated by NEXT_PUBLIC_DEBUG=true to avoid leaking details in prod).
export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const session = await requireSession();
  const debug = process.env.NEXT_PUBLIC_DEBUG === 'true';

  try {
    return await renderConnections(session, searchParams);
  } catch (e) {
    const err = e as Error & { digest?: string; cause?: unknown };
    // If the error is a NEXT_REDIRECT, re-throw so the framework can handle it.
    if (
      (err as { digest?: string }).digest?.toString().startsWith('NEXT_REDIRECT') ||
      err?.message === 'NEXT_REDIRECT'
    ) {
      throw err;
    }
    console.error('[connections] page render failed', err);
    if (!debug) throw err;
    return <DebugPanel error={err} />;
  }
}

async function renderConnections(
  session: Awaited<ReturnType<typeof requireSession>>,
  searchParams: { q?: string }
) {
  const t = await getTranslations();
  const side = sideOfOrgType(session.organization.type);
  const q = (searchParams.q ?? '').trim();

  const partners = await step('listActivePartners', () =>
    listActivePartners(session.organization.id, side)
  );
  const pending = side === 'lab'
    ? await step('listPendingConnections', () =>
        listPendingConnections(session.organization.id, side)
      )
    : [];
  const outgoing = await step('listOutgoingPending', () =>
    listOutgoingPending(session.organization.id, side)
  );
  const directory = await step('fetchDirectory', () =>
    fetchDirectory(side === 'clinic' ? 'lab' : 'clinic', q, session.organization.id)
  );

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
        <ConnectionsActions.Invite invitedType={side === 'clinic' ? 'lab' : 'clinic'} />
      </section>
    </div>
  );
}

function DebugPanel({ error }: { error: Error & { digest?: string; cause?: unknown } }) {
  const cause = (error as { cause?: { message?: string; stack?: string; code?: string; details?: string; hint?: string } }).cause;
  return (
    <div className="max-w-3xl mx-auto">
      <div className="card p-6 border-red-200 bg-red-50/40 space-y-4">
        <div>
          <div className="text-sm font-bold text-red-700">
            DEBUG — /connections caught error
          </div>
          <div className="text-xs text-red-700/80">
            digest: <code className="font-mono">{error.digest ?? '—'}</code>
          </div>
          <div className="text-xs text-red-700/80 mt-1">
            Gated by NEXT_PUBLIC_DEBUG=true. Remove the env var to hide this.
          </div>
        </div>

        <Field label="message" value={error.message} />
        <Field label="name" value={error.name} />
        {cause ? (
          <>
            <Field label="cause.message" value={cause.message ?? ''} />
            <Field label="cause.code" value={cause.code ?? ''} />
            <Field label="cause.details" value={cause.details ?? ''} />
            <Field label="cause.hint" value={cause.hint ?? ''} />
            <Field label="cause.stack" value={cause.stack ?? ''} pre />
          </>
        ) : null}
        <Field label="stack" value={error.stack ?? ''} pre />
      </div>
    </div>
  );
}

function Field({ label, value, pre }: { label: string; value: string; pre?: boolean }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-red-700">
        {label}
      </div>
      <pre
        className={`mt-1 bg-white border border-red-200 rounded-xl p-3 text-xs ${
          pre ? 'whitespace-pre-wrap break-words max-h-[40vh] overflow-auto' : 'whitespace-pre-wrap break-words'
        }`}
      >
        {value}
      </pre>
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
    throw new Error(`fetchDirectory: ${error.message}`);
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
