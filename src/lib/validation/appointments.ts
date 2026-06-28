import { z } from 'zod';

export const appointmentStatusEnum = z.enum([
  'confirmed',
  'completed',
  'cancelled',
  'no_show',
]);

export const appointmentCreateSchema = z.object({
  doctor_id: z.string().uuid(),
  visit_type_id: z.string().uuid(),
  start_at: z.string(),
  patient_name: z.string().min(2).max(120),
  patient_phone: z.string().min(4).max(30),
  patient_age: z.coerce.number().int().min(0).max(130).optional(),
  patient_gender: z.enum(['male', 'female']).optional(),
  patient_email: z.string().email().optional().or(z.literal('')),
  notes: z.string().max(1000).optional().or(z.literal('')),
});

export const appointmentUpdateSchema = z.object({
  start_at: z.string().optional(),
  status: appointmentStatusEnum.optional(),
  notes: z.string().max(1000).optional().or(z.literal('')),
});

export type AppointmentCreateInput = z.infer<typeof appointmentCreateSchema>;
export type AppointmentUpdateInput = z.infer<typeof appointmentUpdateSchema>;
