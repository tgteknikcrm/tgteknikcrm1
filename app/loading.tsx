// Root-level loading skeleton — used during the very first server render
// and for any cross-segment navigation (e.g. /login → /dashboard) before
// the (app) layout itself has hydrated. Shows a full shell so the user
// never sees a blank page.

export default function RootLoading() {
  return (
    <div className="min-h-screen flex">
      {/* Sidebar skeleton (desktop only) */}
      <aside className="hidden md:flex md:w-64 lg:w-72 shrink-0 sticky top-0 h-screen z-20 flex-col bg-sidebar border-r border-sidebar-border">
        <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
          <Bar className="size-9 rounded-lg" />
          <div className="space-y-1.5">
            <Bar className="h-3 w-24" />
            <Bar className="h-2 w-16" />
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1.5">
          {Array.from({ length: 14 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-md px-3 py-2"
            >
              <Bar className="size-4 rounded" />
              <Bar
                className="h-3"
                style={{ width: `${50 + ((i * 7) % 35)}%` }}
              />
            </div>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2.5 rounded-md px-2 py-2">
            <Bar className="size-9 rounded-full shrink-0" />
            <div className="flex-1 space-y-1">
              <Bar className="h-3 w-24" />
              <Bar className="h-2 w-16" />
            </div>
            <Bar className="size-7 rounded shrink-0" />
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile bar */}
        <div className="md:hidden h-12 border-b flex items-center gap-2 px-3 bg-card">
          <Bar className="size-7 rounded shrink-0" />
          <Bar className="h-4 w-20" />
        </div>

        {/* Topbar skeleton */}
        <header className="hidden md:flex sticky top-0 z-30 h-14 bg-background/85 backdrop-blur-md border-b items-center gap-2 px-3 md:px-4">
          <Bar className="flex-1 max-w-md h-9 rounded-md" />
          <div className="ml-auto flex items-center gap-1">
            <Bar className="size-9 rounded-md" />
            <Bar className="size-9 rounded-md" />
            <Bar className="h-9 w-32 rounded-full" />
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-x-hidden space-y-6">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="space-y-2">
              <Bar className="h-7 w-56 max-w-full" />
              <Bar className="h-3 w-72 max-w-full" />
            </div>
            <Bar className="h-9 w-32 rounded-md" />
          </div>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border bg-card overflow-hidden"
              >
                <div className="h-1 w-full bg-muted" />
                <div className="p-4 space-y-3">
                  <Bar className="h-3.5 w-3/5" />
                  <Bar className="h-2.5 w-2/5" />
                  <Bar className="h-7 w-1/2" />
                  <Bar className="h-1.5 w-full rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </main>
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
