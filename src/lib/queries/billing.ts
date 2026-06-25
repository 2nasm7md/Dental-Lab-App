import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { CaseStatus, PaymentStatus } from '@/lib/types/db';

export interface PartnerTotal {
  partner: { id: string; name: string };
  caseCount: number;
  totalBilled: number;
  totalPaid: number;
  balance: number;
  unpaidCount: number;
  partiallyPaidCount: number;
  paidCount: number;
}

// Closed cases that count toward "billed/paid".
// In the spec the ledger reflects what was sent and what was paid — for clarity
// we count cases that have actually been sent (status > draft) and are not cancelled.
const COUNTABLE_STATUSES: CaseStatus[] = [
  'pending',
  'accepted',
  'in_production',
  'ready',
  'delivered',
  'redo',
  'declined',
];

interface CaseLite {
  price: number | null;
  payment_status: PaymentStatus | null;
  status: CaseStatus;
  partner_id: string | null;
  partner_name: string | null;
}

function aggregate(rows: CaseLite[]): PartnerTotal[] {
  const byPartner = new Map<string, PartnerTotal>();
  for (const r of rows) {
    if (!r.partner_id || !r.partner_name) continue;
    if (!COUNTABLE_STATUSES.includes(r.status)) continue;
    let bucket = byPartner.get(r.partner_id);
    if (!bucket) {
      bucket = {
        partner: { id: r.partner_id, name: r.partner_name },
        caseCount: 0,
        totalBilled: 0,
        totalPaid: 0,
        balance: 0,
        unpaidCount: 0,
        partiallyPaidCount: 0,
        paidCount: 0,
      };
      byPartner.set(r.partner_id, bucket);
    }
    bucket.caseCount += 1;
    const price = r.price ?? 0;
    bucket.totalBilled += price;
    // Without explicit "amount paid", we approximate: paid=full, partially=half,
    // unpaid=0. Same approximation for both sides — they see identical numbers.
    const paidFactor =
      r.payment_status === 'paid'
        ? 1
        : r.payment_status === 'partially_paid'
          ? 0.5
          : 0;
    bucket.totalPaid += price * paidFactor;
    if (r.payment_status === 'paid') bucket.paidCount += 1;
    else if (r.payment_status === 'partially_paid') bucket.partiallyPaidCount += 1;
    else bucket.unpaidCount += 1;
  }
  for (const v of byPartner.values()) {
    v.balance = +(v.totalBilled - v.totalPaid).toFixed(2);
    v.totalBilled = +v.totalBilled.toFixed(2);
    v.totalPaid = +v.totalPaid.toFixed(2);
  }
  return [...byPartner.values()].sort((a, b) => b.balance - a.balance);
}

export async function getClinicPartnerTotals(): Promise<PartnerTotal[]> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from('cases')
    .select(
      `price, payment_status, status, lab_org_id, lab:lab_org_id ( id, name )`
    )
    .is('deleted_at', null);
  const rows = (data ?? []) as unknown as Array<{
    price: number | null;
    payment_status: PaymentStatus | null;
    status: CaseStatus;
    lab_org_id: string | null;
    lab: { id: string; name: string } | { id: string; name: string }[] | null;
  }>;
  return aggregate(
    rows.map((r) => {
      const lab = Array.isArray(r.lab) ? r.lab[0] : r.lab;
      return {
        price: r.price,
        payment_status: r.payment_status,
        status: r.status,
        partner_id: lab?.id ?? r.lab_org_id,
        partner_name: lab?.name ?? null,
      };
    })
  );
}

export async function getLabPartnerTotals(): Promise<PartnerTotal[]> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from('cases')
    .select(
      `price, payment_status, status, clinic_org_id, clinic:clinic_org_id ( id, name )`
    )
    .is('deleted_at', null);
  const rows = (data ?? []) as unknown as Array<{
    price: number | null;
    payment_status: PaymentStatus | null;
    status: CaseStatus;
    clinic_org_id: string;
    clinic: { id: string; name: string } | { id: string; name: string }[] | null;
  }>;
  return aggregate(
    rows.map((r) => {
      const clinic = Array.isArray(r.clinic) ? r.clinic[0] : r.clinic;
      return {
        price: r.price,
        payment_status: r.payment_status,
        status: r.status,
        partner_id: clinic?.id ?? r.clinic_org_id,
        partner_name: clinic?.name ?? null,
      };
    })
  );
}
