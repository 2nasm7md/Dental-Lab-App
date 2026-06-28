import { Skeleton } from '@/components/ui/skeleton';

export default function SettingsLoading() {
  return (
    <div className="space-y-6 max-w-xl">
      <Skeleton className="h-6 w-36" />

      {/* org profile card */}
      <div className="card p-5 space-y-4">
        <Skeleton className="h-5 w-32" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-1">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-9 w-full rounded-xl" />
          </div>
        ))}
        <Skeleton className="h-9 w-24 rounded-xl" />
      </div>

      {/* preferences card */}
      <div className="card p-5 space-y-4">
        <Skeleton className="h-5 w-28" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between py-1">
            <div className="space-y-1">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-64" />
            </div>
            <Skeleton className="size-9 rounded-xl shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
