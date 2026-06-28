import { Skeleton } from '@/components/ui/skeleton';

export default function CaseDetailLoading() {
  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-9 w-9 rounded-xl" />
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="ms-auto flex gap-2">
          <Skeleton className="h-9 w-28 rounded-xl" />
          <Skeleton className="h-9 w-28 rounded-xl" />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* main details */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-5 space-y-4">
            <Skeleton className="h-5 w-24" />
            <div className="grid sm:grid-cols-2 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-1">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-4 w-28" />
                </div>
              ))}
            </div>
          </div>

          {/* chat */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-surface-border">
              <Skeleton className="h-5 w-20" />
            </div>
            <div className="p-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className={`flex gap-2 ${i % 2 === 0 ? '' : 'flex-row-reverse'}`}>
                  <Skeleton className="size-8 rounded-full shrink-0" />
                  <Skeleton className="h-12 w-48 rounded-2xl" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* sidebar */}
        <div className="space-y-4">
          <div className="card p-4 space-y-3">
            <Skeleton className="h-5 w-20" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton className="size-2 rounded-full" />
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-20 ms-auto" />
              </div>
            ))}
          </div>

          <div className="card p-4 space-y-3">
            <Skeleton className="h-5 w-24" />
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
