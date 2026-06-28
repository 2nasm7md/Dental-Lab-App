import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const signupSchema = z.object({
  full_name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const onboardingSchema = z.object({
  clinic_name: z.string().min(2).max(80),
  slug: z
    .string()
    .min(3)
    .max(48)
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, 'invalid_slug'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type OnboardingInput = z.infer<typeof onboardingSchema>;
