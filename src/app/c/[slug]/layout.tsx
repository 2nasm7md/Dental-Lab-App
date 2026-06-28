import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createSupabaseAnonClient } from '@/lib/supabase/anon';
import type { ClinicSettings, Tenant } from '@/lib/types/db';
import { PublicHeader } from './_components/public-header';
import { PublicFooter } from './_components/public-footer';

interface Props {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}

async function fetchTenant(slug: string) {
  const supabase = createSupabaseAnonClient();
  const { data: tenant } = await supabase
    .from('tenants')
    .select('*')
    .eq('slug', slug)
    .eq('public', true)
    .single();
  if (!tenant) return null;
  const { data: settings } = await supabase
    .from('clinic_settings')
    .select('*')
    .eq('tenant_id', tenant.id)
    .single();
  return { tenant: tenant as Tenant, settings: settings as ClinicSettings | null };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { slug } = await props.params;
  const data = await fetchTenant(slug);
  if (!data) return {};
  return {
    title: data.settings?.display_name ?? data.tenant.name,
    description: data.settings?.tagline ?? data.settings?.about ?? data.tenant.name,
  };
}

export default async function PublicTenantLayout({ params, children }: Props) {
  const { slug } = await params;
  const data = await fetchTenant(slug);
  if (!data) notFound();
  const { tenant, settings } = data;

  return (
    <div
      className="min-h-screen bg-background"
      style={
        settings
          ? ({
              ['--primary' as never]: hexToHsl(settings.primary_color),
            } as React.CSSProperties)
          : undefined
      }
    >
      <PublicHeader
        slug={tenant.slug}
        name={settings?.display_name ?? tenant.name}
        logoUrl={settings?.logo_url ?? null}
      />
      {children}
      <PublicFooter
        name={settings?.display_name ?? tenant.name}
        phone={settings?.phone ?? null}
        email={settings?.email ?? null}
        address={settings?.address ?? null}
      />
    </div>
  );
}

function hexToHsl(hex: string): string {
  const m = hex.replace('#', '').match(/.{2}/g);
  if (!m || m.length !== 3) return '199 89% 48%';
  const [r, g, b] = m.map((x) => parseInt(x, 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}
