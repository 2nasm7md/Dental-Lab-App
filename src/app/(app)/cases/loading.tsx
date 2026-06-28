import { Skeleton } from '@/components/ui/skeleton';

export default function CasesLoading() {
  return (
    <div className="space-y-4">
      {/* filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Skeleton className="h-9 w-48 rounded-xl" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-lg" />
        ))}
      </div>

      {/* case cards */}
      <div className="card overflow-hidden">
        <div className="divide-y divide-surface-border">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="px-4 py-3 flex items-center gap-3">
              <Skeleton className="size-9 rounded-xl shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-3 w-24" />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
