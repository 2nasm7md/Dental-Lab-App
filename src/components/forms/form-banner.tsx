'use client';

import { useSearchParams } from 'next/navigation';

export function FormBanner() {
  const params = useSearchParams();
  const error = params.get('error');
  if (!error) return null;
  return (
    <div className="mb-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2">
      {error}
    </div>
  );
}
