import { getTranslations } from 'next-intl/server';

interface Props {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
}

export async function PublicFooter({ name, phone, email, address }: Props) {
  const t = await getTranslations('public');
  return (
    <footer className="mt-24 border-t bg-secondary/40">
      <div className="container grid gap-8 py-12 text-sm md:grid-cols-3">
        <div>
          <p className="text-base font-semibold">{name}</p>
          <p className="mt-2 text-muted-foreground">{address ?? ''}</p>
        </div>
        <div>
          <p className="font-semibold">{t('contact')}</p>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            {phone ? <li>{phone}</li> : null}
            {email ? <li>{email}</li> : null}
          </ul>
        </div>
        <div className="md:text-end text-xs text-muted-foreground">
          © {new Date().getFullYear()} {name}
          <br />
          {t('powered_by')}
        </div>
      </div>
    </footer>
  );
}
