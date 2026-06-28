import { z } from 'zod';

export const scheduleDaySchema = z.object({
  doctor_id: z.string().uuid(),
  weekday: z.coerce.number().int().min(0).max(6),
  start_minutes: z.coerce.number().int().min(0).max(1440),
  end_minutes: z.coerce.number().int().min(0).max(1440),
}).refine((d) => d.end_minutes > d.start_minutes, {
  message: 'end_after_start',
  path: ['end_minutes'],
});

export const scheduleBreakSchema = scheduleDaySchema;

export const scheduleAbsenceSchema = z.object({
  doctor_id: z.string().uuid(),
  kind: z.enum(['vacation', 'unavailable']),
  start_at: z.string().min(1),
  end_at: z.string().min(1),
  reason: z.string().max(200).optional().or(z.literal('')),
});

export type ScheduleDayInput = z.infer<typeof scheduleDaySchema>;
export type ScheduleAbsenceInput = z.infer<typeof scheduleAbsenceSchema>;
