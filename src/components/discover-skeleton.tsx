export function DiscoverSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="panel h-44 animate-pulse bg-surface" />
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="card h-80 animate-pulse bg-surface" />
        ))}
      </div>
    </div>
  );
}
