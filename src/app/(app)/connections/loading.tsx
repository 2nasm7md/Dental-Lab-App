import { Skeleton } from '@/components/ui/skeleton';

function PartnerCardSkeleton() {
  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-xl shrink-0" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
    </div>
  );
}

export default function ConnectionsLoading() {
  return (
    <div className="space-y-8">
      {/* connected partners */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-28" />
        <div className="grid md:grid-cols-2 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <PartnerCardSkeleton key={i} />
          ))}
        </div>
      </div>

      {/* directory search */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-9 w-full max-w-sm rounded-xl" />
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <PartnerCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
