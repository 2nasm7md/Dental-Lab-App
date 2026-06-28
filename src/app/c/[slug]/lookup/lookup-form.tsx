'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { publicLookup } from '@/server/actions/public-booking';

interface Result {
  id: string;
  doctor_name: string;
  visit_type: string;
  start_at: string;
  end_at: string;
  status: 'confirmed' | 'completed' | 'cancelled' | 'no_show';
}

export function LookupForm({ slug }: { slug: string }) {
  const t = useTranslations('lookup');
  const tAppt = useTranslations('appointments');
  const [phone, setPhone] = useState('');
  const [results, setResults] = useState<Result[] | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await publicLookup(slug, phone);
            setResults(r as Result[]);
          });
        }}
        className="mt-4 flex gap-2"
      >
        <div className="flex-1">
          <Label htmlFor="phone" className="sr-only">{t('phone')}</Label>
          <Input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t('phone')}
          />
        </div>
        <Button type="submit" disabled={pending || !phone}>
          {pending ? '…' : t('submit')}
        </Button>
      </form>

      {results && results.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">{t('no_results')}</p>
      ) : null}

      {results && results.length > 0 ? (
        <ul className="mt-6 space-y-2">
          {results.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between rounded-md border bg-card p-4"
            >
              <div>
                <p className="font-medium">{r.doctor_name}</p>
                <p className="text-xs text-muted-foreground">
                  {r.visit_type} · {new Date(r.start_at).toLocaleString()}
                </p>
              </div>
              <Badge>{tAppt(`status_${r.status}`)}</Badge>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
