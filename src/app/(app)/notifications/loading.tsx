import { Skeleton } from '@/components/ui/skeleton';

export default function NotificationsLoading() {
  return (
    <div className="space-y-4 max-w-2xl">
      <Skeleton className="h-6 w-28" />

      <div className="card overflow-hidden">
        <div className="divide-y divide-surface-border">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="px-4 py-3 flex items-start gap-3">
              <Skeleton className="size-2 rounded-full mt-2 shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-56" />
              </div>
              <Skeleton className="h-3 w-14 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
