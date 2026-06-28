import { z } from 'zod';

export const clinicSettingsSchema = z.object({
  display_name: z.string().min(2).max(80),
  tagline: z.string().max(140).optional().or(z.literal('')),
  logo_url: z.string().url().optional().or(z.literal('')),
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  secondary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  phone: z.string().max(30).optional().or(z.literal('')),
  whatsapp: z.string().max(30).optional().or(z.literal('')),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().max(300).optional().or(z.literal('')),
  about: z.string().max(2000).optional().or(z.literal('')),
  default_locale: z.enum(['ar', 'en']),
  rtl_enabled: z.coerce.boolean().default(true),
  public: z.coerce.boolean().default(true),
});

export type ClinicSettingsInput = z.infer<typeof clinicSettingsSchema>;
