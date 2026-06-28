import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { createSupabaseAnonClient } from '@/lib/supabase/anon';
import type {
  ClinicSettings,
  Doctor,
  PortfolioCase,
  Tenant,
  VisitType,
} from '@/lib/types/db';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { initials } from '@/lib/utils';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function PublicHomePage(props: Props) {
  const { slug } = await props.params;
  const supabase = createSupabaseAnonClient();
  const { data: tenant } = await supabase
    .from('tenants')
    .select('*')
    .eq('slug', slug)
    .eq('public', true)
    .single();
  if (!tenant) notFound();
  const tenantId = (tenant as Tenant).id;

  const [{ data: settings }, { data: doctors }, { data: visitTypes }, { data: portfolio }] =
    await Promise.all([
      supabase.from('clinic_settings').select('*').eq('tenant_id', tenantId).single(),
      supabase
        .from('doctors')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('active', true)
        .order('name'),
      supabase
        .from('visit_types')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('active', true)
        .order('name'),
      supabase
        .from('portfolio_cases')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(8),
    ]);

  const t = await getTranslations('public');
  const s = settings as ClinicSettings | null;

  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/10 via-background to-background" />
        <div className="container py-24 md:py-32">
          <p className="text-sm font-medium text-primary">{s?.tagline ?? ''}</p>
          <h1 className="mt-2 max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
            {s?.display_name ?? (tenant as Tenant).name}
          </h1>
          {s?.about ? (
            <p className="mt-6 max-w-2xl text-lg text-muted-foreground">{s.about}</p>
          ) : null}
          <div className="mt-8 flex items-center gap-3">
            <Button asChild size="lg">
              <Link href={`/c/${slug}/book`}>
                {t('book_now')} <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={`/c/${slug}/lookup`}>{t('lookup')}</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Doctors */}
      <section id="doctors" className="container py-16">
        <h2 className="text-2xl font-bold">{t('our_doctors')}</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(doctors as Doctor[] | null)?.map((d) => (
            <div key={d.id} className="rounded-lg border bg-card p-6 shadow-card">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  {d.photo_url ? <AvatarImage src={d.photo_url} alt={d.name} /> : null}
                  <AvatarFallback>{initials(d.name)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{d.name}</p>
                  <p className="text-xs text-muted-foreground">{d.specialty}</p>
                </div>
              </div>
              {d.bio ? (
                <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{d.bio}</p>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      {/* Services / Visit types */}
      <section id="services" className="bg-secondary/40 py-16">
        <div className="container">
          <h2 className="text-2xl font-bold">{t('services')}</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(visitTypes as VisitType[] | null)?.map((v) => (
              <div key={v.id} className="rounded-lg border bg-card p-5 shadow-card">
                <p className="font-medium">{v.name}</p>
                <p className="text-sm text-muted-foreground">~ {v.duration_minutes} min</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Portfolio */}
      {(portfolio as PortfolioCase[] | null)?.length ? (
        <section id="portfolio" className="container py-16">
          <h2 className="text-2xl font-bold">{t('before_after')}</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(portfolio as PortfolioCase[]).map((p) => (
              <div
                key={p.id}
                className="overflow-hidden rounded-lg border bg-card shadow-card"
              >
                <div className="grid grid-cols-2 gap-px bg-muted">
                  <img
                    src={p.before_image_url}
                    alt=""
                    className="aspect-square w-full object-cover"
                  />
                  <img
                    src={p.after_image_url}
                    alt=""
                    className="aspect-square w-full object-cover"
                  />
                </div>
                <div className="p-4">
                  <p className="text-sm font-semibold">{p.title}</p>
                  {p.category ? (
                    <p className="text-xs text-muted-foreground">{p.category}</p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Contact */}
      <section id="contact" className="container py-16">
        <div className="rounded-lg border bg-card p-8 shadow-card">
          <h2 className="text-2xl font-bold">{t('contact')}</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3 text-sm">
            {s?.phone ? (
              <div>
                <p className="text-muted-foreground">Phone</p>
                <p className="font-medium">{s.phone}</p>
              </div>
            ) : null}
            {s?.whatsapp ? (
              <div>
                <p className="text-muted-foreground">WhatsApp</p>
                <p className="font-medium">{s.whatsapp}</p>
              </div>
            ) : null}
            {s?.email ? (
              <div>
                <p className="text-muted-foreground">Email</p>
                <p className="font-medium">{s.email}</p>
              </div>
            ) : null}
            {s?.address ? (
              <div className="md:col-span-3">
                <p className="text-muted-foreground">Address</p>
                <p className="font-medium">{s.address}</p>
              </div>
            ) : null}
          </div>
          <div className="mt-6">
            <Button asChild>
              <Link href={`/c/${slug}/book`}>{t('book_now')}</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
