// Skeleton fallback for (app) route segments. Lives inside the (app)
// layout — so sidebar + topbar are already mounted by the parent; this
// only fills in the <main> content while the server component fetches.
//
// Specific routes can override by providing their own ./loading.tsx
// (e.g. /messages already does for the chat shell).

export default function AppLoading() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-2">
          <Bar className="h-7 w-56 max-w-full" />
          <Bar className="h-3 w-72 max-w-full" />
        </div>
        <Bar className="h-9 w-32 rounded-md" />
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border p-4 flex items-center gap-3 bg-card"
          >
            <Bar className="size-10 rounded-lg shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Bar className="h-2.5 w-20" />
              <Bar className="h-6 w-16" />
            </div>
          </div>
        ))}
      </div>

      {/* Generic card grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="h-1 w-full bg-muted" />
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1.5 flex-1">
            <Bar className="h-3.5 w-3/5" />
            <Bar className="h-2.5 w-2/5" />
          </div>
          <Bar className="h-5 w-14 rounded-full" />
        </div>
        <div className="space-y-2 pt-2">
          <Bar className="h-2 w-1/3" />
          <Bar className="h-7 w-1/2" />
          <Bar className="h-1.5 w-full rounded-full" />
        </div>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="flex items-center gap-2">
            <Bar className="size-7 rounded-md" />
            <div className="flex-1 space-y-1">
              <Bar className="h-2 w-12" />
              <Bar className="h-3 w-10" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Bar className="size-7 rounded-md" />
            <div className="flex-1 space-y-1">
              <Bar className="h-2 w-12" />
              <Bar className="h-3 w-10" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Bar({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={style}
      className={`bg-gradient-to-r from-muted via-muted/70 to-muted animate-pulse rounded ${className}`}
    />
  );
}
