import type { ReactNode } from 'react';

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center justify-center text-center py-12 px-6">
      {icon ? <div className="mb-3 text-ink-subtle">{icon}</div> : null}
      <div className="text-base font-semibold text-ink">{title}</div>
      {description ? (
        <div className="mt-1 text-sm text-ink-muted max-w-md">{description}</div>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
