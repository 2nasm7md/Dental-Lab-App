import { Skeleton } from '@/components/ui/skeleton';

export default function NewCaseLoading() {
  return (
    <div className="max-w-2xl space-y-6">
      <Skeleton className="h-6 w-28" />

      <div className="card p-5 space-y-5">
        {/* two-column grid fields */}
        <div className="grid sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-9 w-full rounded-xl" />
            </div>
          ))}
        </div>
        {/* full-width fields */}
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-1">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-9 w-full rounded-xl" />
          </div>
        ))}
        {/* notes */}
        <div className="space-y-1">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
        {/* action buttons */}
        <div className="flex gap-3 pt-2">
          <Skeleton className="h-9 w-28 rounded-xl" />
          <Skeleton className="h-9 w-36 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
