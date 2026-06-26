'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentSession } from '@/lib/current-user';

const CaseInputSchema = z.object({
  owner_doctor_id: z.string().uuid(),
  lab_org_id: z.string().uuid().nullable().optional(),
  patient_name: z.string().optional(),
  patient_ref: z.string().optional(),
  tooth_numbers: z.array(z.string()).default([]),
  restoration_type: z
    .enum([
      'crown',
      'bridge',
      'veneer',
      'inlay_onlay',
      'denture_full',
      'denture_partial',
      'implant_crown',
      'implant_bridge',
      'night_guard',
      'other',
    ])
    .optional(),
  material: z
    .enum(['zirconia', 'emax', 'pfm', 'full_metal', 'pmma', 'acrylic', 'other'])
    .optional(),
  shade: z.string().optional(),
  due_date: z.string().optional().nullable(),
  doctor_notes: z.string().optional(),
  price: z.union([z.number(), z.string().regex(/^\d*\.?\d*$/)]).optional().nullable(),
  send: z.boolean().default(false),
});

export type CaseInput = z.infer<typeof CaseInputSchema>;

export async function createCaseAction(input: CaseInput) {
  const session = await getCurrentSession();
  if (!session?.profile?.organization_id) {
    return { ok: false as const, error: 'Not authenticated' };
  }
  const parsed = CaseInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: 'Invalid input' };
  }
  const v = parsed.data;
  const supabase = createSupabaseServerClient();

  const insertPayload = {
    clinic_org_id: session.profile.organization_id,
    lab_org_id: v.lab_org_id || null,
    owner_doctor_id: v.owner_doctor_id,
    created_by: session.profile.id,
  };

  // Migration 011 funnels case creation through a SECURITY DEFINER RPC so
  // that RLS edge-cases on direct INSERTs can't bite. The RPC does all the
  // authorization the old policy did and returns the new case id.
  const { data: createdId, error } = await supabase.rpc('create_case', {
    p_owner_doctor_id: v.owner_doctor_id,
    p_lab_org_id: v.lab_org_id || null,
    p_patient_name: v.patient_name || '',
    p_patient_ref: v.patient_ref || '',
    p_tooth_numbers: v.tooth_numbers,
    p_restoration_type: v.restoration_type ?? null,
    p_material: v.material ?? null,
    p_shade: v.shade || '',
    p_due_date: v.due_date || null,
    p_doctor_notes: v.doctor_notes || '',
    p_price: v.price != null && v.price !== '' ? Number(v.price) : null,
    p_currency: session.organization?.currency ?? '',
    p_send: Boolean(v.send && v.lab_org_id),
  });
  const created = createdId ? { id: createdId as string } : null;
  if (error || !created) {
    // Surface the live RLS diagnostic back to the form so we don't need
    // Supabase logs to know why the row was rejected. Migration 007 adds
    // the debug_case_rls RPC; if it isn't applied yet, we fall back to a
    // plain error message.
    // Pull every diagnostic we can. Each call is wrapped so one missing RPC
    // (e.g. user hasn't applied 008 yet) doesn't hide the rest.
    const dumpCall = async <T,>(name: string, args: Record<string, unknown>) => {
      try {
        const { data, error: rpcErr } = await supabase.rpc(name, args);
        return rpcErr ? { rpc_error: rpcErr.message } : (data as T);
      } catch (e) {
        return { thrown: (e as Error)?.message ?? String(e) };
      }
    };
    const [rls, tryInsert, policies, triggers] = await Promise.all([
      dumpCall('debug_case_rls', {
        p_clinic_org_id: insertPayload.clinic_org_id,
        p_owner_doctor_id: insertPayload.owner_doctor_id,
      }),
      dumpCall('debug_try_case_insert', {
        p_clinic_org_id: insertPayload.clinic_org_id,
        p_owner_doctor_id: insertPayload.owner_doctor_id,
        p_lab_org_id: insertPayload.lab_org_id,
      }),
      dumpCall('debug_cases_policies', {}),
      dumpCall('debug_cases_triggers', {}),
    ]);
    const detail = JSON.stringify(
      {
        message: error?.message,
        code: (error as { code?: string } | null)?.code,
        details: (error as { details?: string } | null)?.details,
        hint: (error as { hint?: string } | null)?.hint,
        attempted: {
          clinic_org_id: insertPayload.clinic_org_id,
          owner_doctor_id: insertPayload.owner_doctor_id,
          created_by: insertPayload.created_by,
        },
        session: {
          authUserId: session.authUserId,
          profileRole: session.profile?.role,
          profileOrgId: session.profile?.organization_id,
        },
        debug_case_rls: rls,
        debug_try_case_insert: tryInsert,
        debug_cases_policies: policies,
        debug_cases_triggers: triggers,
      },
      null,
      2
    );
    console.error('[createCaseAction] insert failed\n' + detail);
    return { ok: false as const, error: detail };
  }

  // The RPC handles sending internally when p_send=true.

  revalidatePath('/dashboard');
  revalidatePath('/cases');
  return { ok: true as const, caseId: created.id };
}

export async function transitionCaseAction(args: {
  caseId: string;
  action:
    | 'send'
    | 'accept'
    | 'decline'
    | 'reassign'
    | 'cancel'
    | 'advance'
    | 'assign_technician';
  to?: string;
  technicianId?: string;
  reason?: string;
  newLabId?: string;
  note?: string;
}) {
  const supabase = createSupabaseServerClient();
  let result;
  switch (args.action) {
    case 'send':
      result = await supabase.rpc('send_case', { p_case_id: args.caseId });
      break;
    case 'accept':
      result = await supabase.rpc('accept_case', {
        p_case_id: args.caseId,
        p_assigned_technician: args.technicianId ?? null,
      });
      break;
    case 'decline':
      result = await supabase.rpc('decline_case', {
        p_case_id: args.caseId,
        p_reason: args.reason ?? '',
      });
      break;
    case 'reassign':
      result = await supabase.rpc('reassign_case', {
        p_case_id: args.caseId,
        p_new_lab_id: args.newLabId,
      });
      break;
    case 'cancel':
      result = await supabase.rpc('cancel_case', {
        p_case_id: args.caseId,
        p_reason: args.reason ?? null,
      });
      break;
    case 'assign_technician':
      result = await supabase.rpc('assign_technician', {
        p_case_id: args.caseId,
        p_technician: args.technicianId,
      });
      break;
    case 'advance':
      result = await supabase.rpc('advance_case', {
        p_case_id: args.caseId,
        p_to: args.to,
        p_note: args.note ?? null,
      });
      break;
  }
  if (result?.error) {
    return { ok: false as const, error: result.error.message };
  }
  revalidatePath('/dashboard');
  revalidatePath('/cases');
  revalidatePath(`/cases/${args.caseId}`);
  return { ok: true as const };
}

export async function updateCasePaymentAction(args: {
  caseId: string;
  price?: number | null;
  payment_status?: 'unpaid' | 'partially_paid' | 'paid';
}) {
  const supabase = createSupabaseServerClient();
  const patch: Record<string, unknown> = {};
  if (args.price !== undefined) patch.price = args.price;
  if (args.payment_status) patch.payment_status = args.payment_status;
  const { error } = await supabase
    .from('cases')
    .update(patch)
    .eq('id', args.caseId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/cases/${args.caseId}`);
  return { ok: true as const };
}

export async function postCaseMessageAction(args: { caseId: string; body: string }) {
  const session = await getCurrentSession();
  if (!session?.profile) return { ok: false as const, error: 'Not authenticated' };
  if (!args.body.trim()) return { ok: false as const, error: 'Empty message' };
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from('case_messages').insert({
    case_id: args.caseId,
    sender_id: session.profile.id,
    body: args.body.trim(),
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/cases/${args.caseId}`);
  return { ok: true as const };
}
