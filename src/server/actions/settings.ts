'use server';

import { revalidatePath } from 'next/cache';
import { requireOnboarded } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/permissions';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  clinicSettingsSchema,
  type ClinicSettingsInput,
} from '@/lib/validation/settings';

export async function updateClinicSettings(input: ClinicSettingsInput) {
  const session = await requireOnboarded();
  assertPermission(session.role, 'settings.manage');
  const data = clinicSettingsSchema.parse(input);
  const supabase = await createSupabaseServerClient();

  const { error: e1 } = await supabase
    .from('clinic_settings')
    .update({
      display_name: data.display_name,
      tagline: data.tagline || null,
      logo_url: data.logo_url || null,
      primary_color: data.primary_color,
      secondary_color: data.secondary_color,
      phone: data.phone || null,
      whatsapp: data.whatsapp || null,
      email: data.email || null,
      address: data.address || null,
      about: data.about || null,
      default_locale: data.default_locale,
      rtl_enabled: data.rtl_enabled,
    })
    .eq('tenant_id', session.tenantId);
  if (e1) throw new Error(e1.message);

  const { error: e2 } = await supabase
    .from('tenants')
    .update({ public: data.public })
    .eq('id', session.tenantId);
  if (e2) throw new Error(e2.message);

  revalidatePath('/settings');
  revalidatePath(`/c/[slug]`, 'layout');
}
