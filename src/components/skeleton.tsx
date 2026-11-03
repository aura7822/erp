export const Skeleton = ({ className = "" }: { className?: string }) => <div aria-hidden className={`skeleton ${className}`} />;

export function PageSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div role="status" aria-label="Loading" aria-busy="true">
      <div className="mb-6 flex items-center gap-3"><Skeleton className="h-10 w-10 !rounded-full" /><div className="space-y-2"><Skeleton className="h-7 w-56" /><Skeleton className="h-3.5 w-36" /></div></div>
      <div className={`grid grid-cols-2 gap-4 lg:grid-cols-${Math.min(cards, 5)}`}>
        {Array.from({ length: cards }).map((_, i) => <div key={i} className="card p-4"><Skeleton className="h-3.5 w-20" /><Skeleton className="mt-3 h-7 w-28" /><Skeleton className="mt-2 h-3 w-24" /></div>)}
      </div>
      <div className="card mt-6 p-5">
        <Skeleton className="h-5 w-44" />
        <div className="mt-5 space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export function CardsSkeleton({ n = 6 }: { n?: number }) {
  return (
    <div role="status" aria-busy="true" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: n }).map((_, i) => <div key={i} className="card p-5"><Skeleton className="h-6 w-32" /><Skeleton className="mt-4 h-4 w-full" /><Skeleton className="mt-2 h-4 w-3/4" /><Skeleton className="mt-5 h-9 w-24" /></div>)}
      <span className="sr-only">Loading…</span>
    </div>
  );
}
