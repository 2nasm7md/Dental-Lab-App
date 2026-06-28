/**
 * Availability engine — pure functions, used both server-side (booking RPC
 * validation, dashboard slot suggestions) and client-side (booking flow).
 *
 * All "minutes" values are minutes-since-midnight in the *clinic's local* day.
 * We treat the input `date` as a Y-M-D in UTC for simplicity and combine it
 * with the doctor's schedule_days/breaks to derive concrete time ranges.
 */

import type {
  Appointment,
  ScheduleAbsence,
  ScheduleBreak,
  ScheduleDay,
} from '@/lib/types/db';

export interface AvailabilityInput {
  date: Date;
  visitDurationMinutes: number;
  workingDays: ScheduleDay[];
  breaks: ScheduleBreak[];
  absences: ScheduleAbsence[];
  appointments: Appointment[];
  slotStepMinutes?: number;
}

export interface AvailableSlot {
  startAt: Date;
  endAt: Date;
}

interface Range {
  start: number; // minutes since the start of `date`
  end: number;
}

function dayBoundary(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

function minutesFromMidnight(d: Date, ref: Date): number {
  return Math.round((d.getTime() - ref.getTime()) / 60_000);
}

function subtractRanges(base: Range[], cuts: Range[]): Range[] {
  const out: Range[] = [];
  for (const b of base) {
    let pieces: Range[] = [b];
    for (const c of cuts) {
      const next: Range[] = [];
      for (const p of pieces) {
        if (c.end <= p.start || c.start >= p.end) {
          next.push(p);
          continue;
        }
        if (c.start > p.start) next.push({ start: p.start, end: Math.min(c.start, p.end) });
        if (c.end < p.end) next.push({ start: Math.max(c.end, p.start), end: p.end });
      }
      pieces = next.filter((r) => r.end > r.start);
    }
    out.push(...pieces);
  }
  return out.sort((a, b) => a.start - b.start);
}

export function computeAvailableSlots(input: AvailabilityInput): AvailableSlot[] {
  const { date, visitDurationMinutes, workingDays, breaks, absences, appointments } = input;
  const step = input.slotStepMinutes ?? 15;
  const { start: dayStart, end: dayEnd } = dayBoundary(date);

  // Weekday in UTC — mirrors the way schedule_days.weekday is interpreted.
  const weekday = dayStart.getUTCDay();

  // Build base "available" ranges from working hours of this weekday.
  const working: Range[] = workingDays
    .filter((d) => d.weekday === weekday)
    .map((d) => ({ start: d.start_minutes, end: d.end_minutes }))
    .sort((a, b) => a.start - b.start);

  if (working.length === 0) return [];

  // Cuts: weekly breaks for this weekday.
  const breakRanges: Range[] = breaks
    .filter((b) => b.weekday === weekday)
    .map((b) => ({ start: b.start_minutes, end: b.end_minutes }));

  // Cuts: absences that intersect [dayStart, dayEnd).
  const absenceRanges: Range[] = absences
    .map((a) => ({
      start: Math.max(minutesFromMidnight(new Date(a.start_at), dayStart), 0),
      end: Math.min(minutesFromMidnight(new Date(a.end_at), dayStart), 1440),
    }))
    .filter((r) => r.end > 0 && r.start < 1440 && r.end > r.start);

  // Cuts: existing appointments (only confirmed/completed block slots).
  const apptRanges: Range[] = appointments
    .filter((a) => a.status === 'confirmed' || a.status === 'completed')
    .map((a) => ({
      start: Math.max(minutesFromMidnight(new Date(a.start_at), dayStart), 0),
      end: Math.min(minutesFromMidnight(new Date(a.end_at), dayStart), 1440),
    }))
    .filter((r) => r.end > 0 && r.start < 1440 && r.end > r.start);

  const free = subtractRanges(working, [...breakRanges, ...absenceRanges, ...apptRanges]);

  const now = Date.now();
  const slots: AvailableSlot[] = [];
  for (const range of free) {
    let cursor = Math.ceil(range.start / step) * step;
    while (cursor + visitDurationMinutes <= range.end) {
      const slotStart = new Date(dayStart.getTime() + cursor * 60_000);
      if (slotStart.getTime() > now) {
        slots.push({
          startAt: slotStart,
          endAt: new Date(slotStart.getTime() + visitDurationMinutes * 60_000),
        });
      }
      cursor += step;
    }
  }

  return slots;
}
