import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('app');
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-primary p-12 text-primary-foreground lg:flex">
        <Link href="/" className="text-xl font-bold">
          {t('name')}
        </Link>
        <div>
          <h1 className="text-3xl font-bold leading-tight">
            Run your dental clinic with confidence.
          </h1>
          <p className="mt-3 text-primary-foreground/80">{t('tagline')}</p>
        </div>
        <p className="text-sm text-primary-foreground/60">
          © {new Date().getFullYear()} {t('name')}
        </p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
