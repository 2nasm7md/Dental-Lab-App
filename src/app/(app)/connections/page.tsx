// ============================================================================
// /connections — DIAGNOSTIC MODE
// Every step (env, auth, each Supabase query) runs inside its own try/catch
// and the whole page returns a plain <pre> with the trace. There is no
// error boundary involvement. There is no redirect. The point is to see
// exactly what blows up on the live deploy.
//
// When the real cause is known, revert this file to the previous JSX page.
// ============================================================================

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentSession } from '@/lib/current-user';
import { sideOfOrgType } from '@/lib/case-state-machine';

function fmt(e: unknown): string {
  if (!e) return '<no error>';
  const err = e as {
    name?: string;
    message?: string;
    code?: string;
    details?: string;
    hint?: string;
    stack?: string;
    cause?: unknown;
  };
  const parts = [
    `name:    ${err.name ?? '<no name>'}`,
    `message: ${err.message ?? String(e)}`,
    err.code ? `code:    ${err.code}` : null,
    err.details ? `details: ${err.details}` : null,
    err.hint ? `hint:    ${err.hint}` : null,
    err.stack ? `stack:\n${err.stack}` : null,
    err.cause ? `cause:\n${fmt(err.cause).split('\n').map((l) => '  ' + l).join('\n')}` : null,
  ].filter(Boolean);
  return parts.join('\n');
}

interface StepResult {
  name: string;
  ok: boolean;
  detail: string;
}

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const steps: StepResult[] = [];
  const log = (name: string, ok: boolean, detail: string) => {
    steps.push({ name, ok, detail });
    // Also send to Vercel function logs.
    if (ok) console.log(`[connections:${name}] OK ${detail}`);
    else console.error(`[connections:${name}] FAIL\n${detail}`);
  };

  // --- Env ---
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
    const svc = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
    const debug = process.env.NEXT_PUBLIC_DEBUG ?? '';
    log(
      'env',
      Boolean(url && anon),
      [
        `NEXT_PUBLIC_SUPABASE_URL: ${url ? url : '<MISSING>'}`,
        `NEXT_PUBLIC_SUPABASE_ANON_KEY: ${anon ? `<set, length=${anon.length}, starts=${anon.slice(0, 8)}…>` : '<MISSING>'}`,
        `SUPABASE_SERVICE_ROLE_KEY: ${svc ? `<set, length=${svc.length}>` : '<MISSING>'}`,
        `NEXT_PUBLIC_DEBUG: ${debug || '<not set>'}`,
        `NODE_ENV: ${process.env.NODE_ENV}`,
      ].join('\n')
    );
  } catch (e) {
    log('env', false, fmt(e));
  }

  // --- Supabase client construction ---
  let supabase: ReturnType<typeof createSupabaseServerClient> | null = null;
  try {
    supabase = createSupabaseServerClient();
    log('createSupabaseServerClient', true, 'client constructed');
  } catch (e) {
    log('createSupabaseServerClient', false, fmt(e));
  }

  // --- Auth state ---
  let session: Awaited<ReturnType<typeof getCurrentSession>> = null;
  try {
    session = await getCurrentSession();
    if (!session) {
      log('auth.getCurrentSession', true, 'session=null (NOT LOGGED IN)');
    } else {
      log(
        'auth.getCurrentSession',
        true,
        [
          `authUserId: ${session.authUserId}`,
          `email: ${session.email}`,
          `profile: ${session.profile ? 'present' : 'MISSING'}`,
          session.profile
            ? `  profile.role: ${session.profile.role}\n  profile.organization_id: ${session.profile.organization_id}`
            : '',
          `organization: ${session.organization ? 'present' : 'MISSING'}`,
          session.organization
            ? `  organization.id: ${session.organization.id}\n  organization.type: ${session.organization.type}\n  organization.name: ${session.organization.name}`
            : '',
        ]
          .filter(Boolean)
          .join('\n')
      );
    }
  } catch (e) {
    log('auth.getCurrentSession', false, fmt(e));
  }

  // The remaining steps depend on a complete session.
  let side: 'clinic' | 'lab' | null = null;
  if (session?.organization && session.profile?.role) {
    try {
      side = sideOfOrgType(session.organization.type);
      log('sideOfOrgType', true, `side=${side}`);
    } catch (e) {
      log('sideOfOrgType', false, fmt(e));
    }
  } else {
    log(
      'side',
      false,
      'skipped — session.organization or session.profile.role is missing. ' +
        'Normally this would redirect to /login or /onboarding.'
    );
  }

  const orgId = session?.organization?.id ?? null;

  // --- Query 1: organizations (sanity) ---
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name, type')
        .limit(3);
      if (error) {
        log('q1.organizations.select', false, fmt(error));
      } else {
        log(
          'q1.organizations.select',
          true,
          `rows=${data?.length ?? 0}\n${(data ?? []).map((r) => `  - ${r.type}: ${r.name}`).join('\n')}`
        );
      }
    } catch (e) {
      log('q1.organizations.select', false, fmt(e));
    }
  }

  // --- Query 2: users (sanity) ---
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, role, organization_id')
        .limit(3);
      if (error) log('q2.users.select', false, fmt(error));
      else log('q2.users.select', true, `rows=${data?.length ?? 0}`);
    } catch (e) {
      log('q2.users.select', false, fmt(e));
    }
  }

  // --- Query 3: connections (the page's actual table) ---
  if (supabase && orgId && side) {
    try {
      const column = side === 'clinic' ? 'clinic_org_id' : 'lab_org_id';
      const { data, error } = await supabase
        .from('connections')
        .select('id, clinic_org_id, lab_org_id, status')
        .eq(column, orgId);
      if (error) log('q3.connections.select', false, fmt(error));
      else
        log(
          'q3.connections.select',
          true,
          `rows=${data?.length ?? 0}\n${(data ?? [])
            .map((r) => `  - ${r.status} clinic=${r.clinic_org_id} lab=${r.lab_org_id}`)
            .join('\n')}`
        );
    } catch (e) {
      log('q3.connections.select', false, fmt(e));
    }
  }

  // --- Query 4: directory search ---
  if (supabase && orgId && side) {
    const q = (searchParams.q ?? '').trim();
    const directoryType = side === 'clinic' ? 'lab' : 'clinic';
    try {
      let query = supabase
        .from('organizations')
        .select('id, name, type, phone, email, logo_url')
        .eq('type', directoryType)
        .is('deleted_at', null)
        .neq('id', orgId)
        .order('name')
        .limit(50);
      if (q) {
        const safe = q.replace(/[%(),:]/g, '');
        query = query.or(`name.ilike.%${safe}%,phone.ilike.%${safe}%`);
      }
      const { data, error } = await query;
      if (error) log('q4.directory.select', false, fmt(error));
      else
        log(
          'q4.directory.select',
          true,
          `q=${q || '<empty>'} type=${directoryType} rows=${data?.length ?? 0}`
        );
    } catch (e) {
      log('q4.directory.select', false, fmt(e));
    }
  }

  // --- Query 5: connections embed (the prime suspect from earlier diagnosis) ---
  if (supabase && orgId && side) {
    try {
      const column = side === 'clinic' ? 'clinic_org_id' : 'lab_org_id';
      const otherColumn = side === 'clinic' ? 'lab_org_id' : 'clinic_org_id';
      const { data, error } = await supabase
        .from('connections')
        .select(
          `id, ${otherColumn}, partner:${otherColumn} ( id, name, type, phone, email, logo_url )`
        )
        .eq(column, orgId)
        .eq('status', 'active');
      if (error) log('q5.connections.embed', false, fmt(error));
      else {
        const first = data?.[0] as Record<string, unknown> | undefined;
        log(
          'q5.connections.embed',
          true,
          `rows=${data?.length ?? 0}\nfirst.partner typeof: ${
            first ? (Array.isArray(first.partner) ? 'array' : typeof first.partner) : '<no rows>'
          }\nfirst (raw): ${JSON.stringify(first, null, 2)}`
        );
      }
    } catch (e) {
      log('q5.connections.embed', false, fmt(e));
    }
  }

  const anyFail = steps.some((s) => !s.ok);

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="card p-5 space-y-2">
        <div className="text-base font-bold text-ink">
          /connections diagnostic dump
        </div>
        <div className="text-sm text-ink-muted">
          {anyFail
            ? 'At least one step failed — read the FAIL block(s) below.'
            : 'Every step succeeded. The page would normally render its UI now.'}
        </div>
        <div className="text-xs text-ink-subtle">
          To revert to the normal /connections page, restore this file from
          commit <code>ad9f828</code> (the JSX version) and remove
          NEXT_PUBLIC_DEBUG.
        </div>
      </div>

      {steps.map((s, i) => (
        <div
          key={i}
          className={`card p-4 ${
            s.ok ? 'border-emerald-200 bg-emerald-50/40' : 'border-red-200 bg-red-50/40'
          }`}
        >
          <div
            className={`text-sm font-semibold ${
              s.ok ? 'text-emerald-700' : 'text-red-700'
            }`}
          >
            {s.ok ? 'OK' : 'FAIL'} — {s.name}
          </div>
          <pre className="mt-2 whitespace-pre-wrap break-words text-xs bg-white border border-surface-border rounded-xl p-3 max-h-[40vh] overflow-auto">
            {s.detail || '<empty>'}
          </pre>
        </div>
      ))}
    </div>
  );
}
