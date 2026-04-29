// Skeleton shown while /messages server component is fetching its data.
// Mirrors the 2-pane layout so the UI doesn't jump when data lands.

export default function MessagesLoading() {
  return (
    <div className="-m-4 md:-m-6 lg:-m-8 h-[calc(100vh-3.5rem)] grid grid-cols-1 md:grid-cols-[20rem_1fr] lg:grid-cols-[22rem_1fr] overflow-hidden">
      {/* LEFT — list skeleton */}
      <aside className="border-r overflow-hidden flex flex-col bg-card/30">
        <div className="p-3 border-b flex items-center justify-between gap-2">
          <Bar className="h-5 w-24" />
          <Bar className="h-7 w-14" />
        </div>
        <div className="p-2 border-b">
          <Bar className="h-9 w-full rounded-md" />
        </div>
        <div className="p-2 border-b flex gap-1.5">
          <Bar className="h-7 w-16" />
          <Bar className="h-7 w-16" />
          <Bar className="h-7 w-16" />
        </div>
        <div className="flex-1 overflow-hidden divide-y">
          {Array.from({ length: 8 }).map((_, i) => (
            <RowSkeleton key={i} />
          ))}
        </div>
      </aside>

      {/* RIGHT — chat skeleton */}
      <section className="overflow-hidden flex flex-col bg-background">
        <header className="flex items-center gap-3 px-3 py-2.5 border-b shrink-0 bg-card/50">
          <Bar className="size-9 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Bar className="h-3.5 w-32" />
            <Bar className="h-2.5 w-20" />
          </div>
          <Bar className="size-9 rounded-md shrink-0" />
        </header>
        <div className="flex-1 overflow-hidden p-3 sm:p-4 space-y-3 bg-muted/20">
          <div className="text-center my-3">
            <Bar className="inline-block h-4 w-20 rounded-full" />
          </div>
          <div className="space-y-2">
            <BubbleSkeleton side="left" w="w-48" />
            <BubbleSkeleton side="left" w="w-32" />
            <BubbleSkeleton side="right" w="w-40" />
            <BubbleSkeleton side="right" w="w-56" />
            <BubbleSkeleton side="left" w="w-28" />
            <BubbleSkeleton side="right" w="w-36" />
          </div>
        </div>
        <div className="border-t bg-card/50 px-2 sm:px-3 py-2 flex items-end gap-1.5">
          <Bar className="size-9 rounded-full shrink-0" />
          <Bar className="size-9 rounded-full shrink-0" />
          <Bar className="flex-1 h-9 rounded-2xl" />
          <Bar className="size-9 rounded-full shrink-0" />
        </div>
      </section>
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <Bar className="size-11 rounded-full shrink-0" />
      <div className="flex-1 space-y-1.5 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <Bar className="h-3.5 w-24" />
          <Bar className="h-2.5 w-8" />
        </div>
        <Bar className="h-2.5 w-3/4" />
      </div>
    </div>
  );
}

function BubbleSkeleton({
  side,
  w,
}: {
  side: "left" | "right";
  w: string;
}) {
  return (
    <div
      className={`flex gap-2 ${side === "right" ? "flex-row-reverse" : ""}`}
    >
      {side === "left" && <Bar className="size-7 rounded-full shrink-0" />}
      <Bar className={`h-9 ${w} rounded-2xl`} />
    </div>
  );
}

// Themed skeleton bar — shimmer animation comes from Tailwind's animate-pulse
// plus a soft gradient so it reads as "data is on the way", not "broken".
function Bar({ className = "" }: { className?: string }) {
  return (
    <div
      className={`bg-gradient-to-r from-muted via-muted/70 to-muted animate-pulse rounded ${className}`}
    />
  );
}
