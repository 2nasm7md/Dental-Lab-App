import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { SignupForm } from './signup-form';

export default async function SignupPage() {
  const t = await getTranslations('auth');
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">{t('signup')}</h2>
      <SignupForm />
      <p className="text-sm text-muted-foreground">
        {t('to_login')}{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          {t('login')}
        </Link>
      </p>
    </div>
  );
}
