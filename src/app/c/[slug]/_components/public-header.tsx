import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';

interface Props {
  slug: string;
  name: string;
  logoUrl: string | null;
}

export async function PublicHeader({ slug, name, logoUrl }: Props) {
  const t = await getTranslations('public');
  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        <Link href={`/c/${slug}`} className="flex items-center gap-2 font-bold">
          {logoUrl ? (
            <img src={logoUrl} alt={name} className="h-8 w-8 rounded object-cover" />
          ) : (
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              {name[0]?.toUpperCase()}
            </span>
          )}
          <span>{name}</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm md:flex">
          <Link href={`/c/${slug}#doctors`} className="hover:text-primary">
            {t('our_doctors')}
          </Link>
          <Link href={`/c/${slug}#services`} className="hover:text-primary">
            {t('services')}
          </Link>
          <Link href={`/c/${slug}#portfolio`} className="hover:text-primary">
            {t('before_after')}
          </Link>
          <Link href={`/c/${slug}#contact`} className="hover:text-primary">
            {t('contact')}
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href={`/c/${slug}/lookup`}>{t('lookup')}</Link>
          </Button>
          <Button asChild size="sm">
            <Link href={`/c/${slug}/book`}>{t('book_now')}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
