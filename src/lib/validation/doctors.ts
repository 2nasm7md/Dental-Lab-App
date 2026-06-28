import { z } from 'zod';

export const doctorSchema = z.object({
  name: z.string().min(2).max(120),
  specialty: z.string().max(120).optional().or(z.literal('')),
  photo_url: z.string().url().optional().or(z.literal('')),
  bio: z.string().max(2000).optional().or(z.literal('')),
  active: z.coerce.boolean().default(true),
});

export type DoctorInput = z.infer<typeof doctorSchema>;
