import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ArrowRight, CalendarCheck, ShieldCheck, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default async function MarketingPage() {
  const t = await getTranslations('app');
  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-secondary/40">
      <header className="container flex items-center justify-between py-6">
        <div className="flex items-center gap-2 font-bold text-lg">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            D
          </span>
          {t('name')}
        </div>
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/signup">
              Start free <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </nav>
      </header>

      <section className="container py-24 text-center">
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
          The clinic operating system for modern dental practices.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Doctor profiles, schedules, online booking, a public website — one
          platform that scales with your clinic and your patients.
        </p>
        <div className="mt-10 flex items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/signup">Get started free</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </section>

      <section className="container grid gap-6 pb-24 md:grid-cols-3">
        {[
          {
            icon: CalendarCheck,
            title: 'Bookings that fit',
            body: 'Smart slot engine respects working hours, breaks, vacations and visit duration.',
          },
          {
            icon: Users,
            title: 'Doctors & schedules',
            body: 'Manage doctors, specialties, weekly hours and time off in one place.',
          },
          {
            icon: ShieldCheck,
            title: 'Secure by design',
            body: 'Multi-tenant with Postgres RLS — every clinic is isolated at the database.',
          },
        ].map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-lg border bg-card p-6 shadow-card">
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
