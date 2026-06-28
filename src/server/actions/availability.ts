'use server';

import { requireOnboarded } from '@/lib/auth/session';
import { fetchAvailability } from '@/lib/availability/fetch';

export async function getAvailability(
  doctorId: string,
  isoDate: string,
  visitDurationMinutes: number
) {
  await requireOnboarded();
  const date = new Date(isoDate);
  const slots = await fetchAvailability({
    tenantId: '', // unused — RLS scopes
    doctorId,
    date,
    visitDurationMinutes,
  });
  return slots.map((s) => ({
    startAt: s.startAt.toISOString(),
    endAt: s.endAt.toISOString(),
  }));
}
