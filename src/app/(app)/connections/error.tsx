'use client';

import { useEffect } from 'react';

export default function ConnectionsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Mirrors the server log so it's easy to grep in Vercel logs too.
    console.error('[connections] route error:', error);
  }, [error]);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="card p-6 border-red-200 bg-red-50/40 space-y-4">
        <div>
          <div className="text-sm font-semibold text-red-700">Connections page error</div>
          <div className="text-xs text-red-700/80">
            digest: <code className="font-mono">{error.digest ?? '—'}</code>
          </div>
        </div>
        <pre className="text-xs whitespace-pre-wrap break-words bg-white border border-red-200 rounded-xl p-3 max-h-[60vh] overflow-auto">
{error.message}
{error.stack ? '\n\n' + error.stack : ''}
        </pre>
        <button onClick={reset} className="btn-secondary">
          Try again
        </button>
      </div>
    </div>
  );
}
