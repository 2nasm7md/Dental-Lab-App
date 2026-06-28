import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { LoginForm } from './login-form';

export default async function LoginPage() {
  const t = await getTranslations('auth');
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{t('login')}</h2>
      </div>
      <LoginForm />
      <p className="text-sm text-muted-foreground">
        {t('to_signup')}{' '}
        <Link href="/signup" className="font-medium text-primary hover:underline">
          {t('signup')}
        </Link>
      </p>
    </div>
  );
}
