import { z } from 'zod';

export const visitTypeSchema = z.object({
  name: z.string().min(1).max(80),
  duration_minutes: z.coerce.number().int().min(5).max(480),
  active: z.coerce.boolean().default(true),
});

export type VisitTypeInput = z.infer<typeof visitTypeSchema>;
