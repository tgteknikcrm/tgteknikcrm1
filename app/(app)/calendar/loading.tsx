// Skeleton mirroring the calendar shell — toolbar + month grid.

export default function CalendarLoading() {
  return (
    <div className="-m-4 md:-m-6 lg:-m-8 h-[calc(100vh-3.5rem)] flex flex-col bg-background">
      <div className="px-3 sm:px-4 py-2 border-b flex items-center gap-2 flex-wrap bg-card/30">
        <Bar className="size-5 rounded shrink-0" />
        <Bar className="h-5 w-24" />
        <div className="ml-2 flex items-center gap-0.5">
          <Bar className="h-8 w-16 rounded-md" />
          <Bar className="size-8 rounded-md" />
          <Bar className="size-8 rounded-md" />
        </div>
        <Bar className="h-5 w-32 ml-1" />
        <div className="ml-auto flex items-center gap-1">
          <Bar className="h-8 w-32 rounded-lg" />
          <Bar className="h-8 w-32 rounded-md" />
        </div>
      </div>

      {/* Month-grid skeleton */}
      <div className="flex-1 flex flex-col">
        <div className="grid grid-cols-7 border-b bg-muted/30">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="px-2 py-1.5 text-center">
              <Bar className="h-3 w-8 mx-auto" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 grid-rows-6 flex-1">
          {Array.from({ length: 42 }).map((_, i) => (
            <div
              key={i}
              className="border-r border-b p-1 flex flex-col gap-1 min-w-0 overflow-hidden"
            >
              <Bar className="size-6 rounded-full" />
              {i % 5 === 0 && <Bar className="h-3 w-3/4 rounded" />}
              {i % 7 === 0 && <Bar className="h-3 w-2/3 rounded" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Bar({ className = "" }: { className?: string }) {
  return (
    <div
      className={`bg-gradient-to-r from-muted via-muted/70 to-muted animate-pulse rounded ${className}`}
    />
  );
}
