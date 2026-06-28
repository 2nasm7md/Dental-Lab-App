import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse rounded-lg bg-surface-border', className)} />
  );
}

export function SkeletonCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('card p-4', className)}>{children}</div>
  );
}
