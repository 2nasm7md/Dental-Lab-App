'use client';

import { useTranslations } from 'next-intl';
import { FDI_TOP, FDI_BOTTOM } from '@/lib/dental';
import { cn } from '@/lib/utils';

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
}

export function ToothSelector({ value, onChange }: Props) {
  const t = useTranslations();
  const toggle = (n: string) => {
    onChange(value.includes(n) ? value.filter((x) => x !== n) : [...value, n]);
  };

  return (
    <div>
      <div className="label">{t('case.selectTooth')}</div>
      <div className="card p-4 space-y-2">
        <div className="grid grid-cols-16 gap-1 [grid-template-columns:repeat(16,minmax(0,1fr))]">
          {FDI_TOP.map((n) => (
            <ToothCell key={n} n={n} selected={value.includes(n)} onClick={() => toggle(n)} />
          ))}
          {FDI_BOTTOM.map((n) => (
            <ToothCell key={n} n={n} selected={value.includes(n)} onClick={() => toggle(n)} />
          ))}
        </div>
        {value.length > 0 ? (
          <div className="text-xs text-ink-muted">{value.join(' · ')}</div>
        ) : null}
      </div>
    </div>
  );
}

function ToothCell({
  n,
  selected,
  onClick,
}: {
  n: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'aspect-square rounded-md text-[10px] font-semibold border transition-colors flex items-center justify-center',
        selected
          ? 'bg-brand-600 text-white border-brand-700'
          : 'bg-white text-ink-muted border-surface-border hover:bg-surface-muted'
      )}
    >
      {n}
    </button>
  );
}
