"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Loader2, Check, Inbox, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { markAllActivityRead } from "@/app/(app)/activity/actions";
import {
  EVENT_META,
  TONE_CLASSES,
  CATEGORY_LABEL,
  groupEventsByDay,
  relativeTime,
  type ActivityCategory,
} from "@/components/app/activity-config";
import type { ActivityEvent, ActivityEventType } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

const FILTERS: { key: "all" | ActivityCategory; label: string }[] = [
  { key: "all", label: "Tümü" },
  { key: "kalite", label: "Kalite" },
  { key: "is", label: "İşler" },
  { key: "uretim", label: "Üretim" },
  { key: "makine", label: "Makine" },
  { key: "kullanici", label: "Kullanıcı" },
];

export function NotificationBell({
  variant = "list",
}: {
  variant?: "list" | "icon";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [lastReadAt, setLastReadAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | ActivityCategory>("all");
  const [marking, startMarking] = useTransition();

  const fetchInitial = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    const [evRes, readRes] = await Promise.all([
      supabase
        .from("activity_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("activity_reads")
        .select("last_read_at")
        .maybeSingle(),
    ]);
    setEvents((evRes.data ?? []) as ActivityEvent[]);
    setLastReadAt(
      (readRes.data as { last_read_at: string } | null)?.last_read_at ?? null,
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchInitial();
  }, [fetchInitial]);

  // Realtime subscription — prepend new events as they're inserted.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("activity-events")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_events" },
        (payload) => {
          const ev = payload.new as ActivityEvent;
          setEvents((prev) => [ev, ...prev].slice(0, 100));
          // Refresh visible page data so other lists pick up changes too
          router.refresh();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  const unreadCount = events.filter((e) => {
    if (!lastReadAt) return true;
    return new Date(e.created_at) > new Date(lastReadAt);
  }).length;

  function onMarkAll() {
    startMarking(async () => {
      const r = await markAllActivityRead();
      if (!r.error) {
        setLastReadAt(new Date().toISOString());
      }
    });
  }

  const filtered =
    filter === "all"
      ? events
      : events.filter((e) => EVENT_META[e.event_type]?.category === filter);
  const grouped = groupEventsByDay(filtered);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {variant === "icon" ? (
          <Button
            variant="ghost"
            size="icon"
            className="relative size-9"
            title="Bildirimler"
          >
            <Bell
              className={cn("size-5", unreadCount > 0 && "animate-pulse")}
            />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center tabular-nums shadow">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="relative h-9 w-full justify-start gap-2 px-3 font-medium"
            title="Bildirimler"
          >
            <Bell
              className={cn("size-4", unreadCount > 0 && "animate-pulse")}
            />
            <span className="text-sm">Bildirimler</span>
            {unreadCount > 0 && (
              <Badge
                className={cn(
                  "ml-auto h-5 min-w-5 px-1.5 text-[10px] tabular-nums",
                  "bg-red-500 hover:bg-red-500 text-white",
                )}
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </Badge>
            )}
          </Button>
        )}
      </SheetTrigger>

      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 flex flex-col gap-0"
      >
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Bell className="size-4" />
            Bildirimler
            {unreadCount > 0 && (
              <Badge variant="outline" className="ml-2 h-5 text-[10px]">
                {unreadCount} yeni
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription className="text-xs">
            Atölyede olan biten her şey — kim ne yaptı, ne zaman.
          </SheetDescription>
        </SheetHeader>

        {/* Filters */}
        <div className="px-4 py-2 border-b flex items-center gap-1.5 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium border transition shrink-0",
                filter === f.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground hover:bg-muted",
              )}
            >
              {f.label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1 shrink-0">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onMarkAll}
                disabled={marking}
                className="h-7 px-2 text-xs gap-1"
                title="Tümünü okundu işaretle"
              >
                {marking ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Check className="size-3" />
                )}
                Okudum
              </Button>
            )}
          </div>
        </div>

        {/* Feed */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="p-6 flex items-center justify-center text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Inbox className="size-10 mx-auto opacity-30 mb-2" />
              <p className="text-sm">Bildirim yok.</p>
            </div>
          ) : (
            grouped.map((g) => (
              <div key={g.label}>
                <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/40 sticky top-0 z-10">
                  {g.label}
                </div>
                <div className="divide-y">
                  {g.items.map((e) => (
                    <ActivityRow
                      key={e.id}
                      event={e}
                      isUnread={!lastReadAt || new Date(e.created_at) > new Date(lastReadAt)}
                      onNavigate={() => setOpen(false)}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-3">
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link href="/activity" onClick={() => setOpen(false)}>
              Tüm Aktiviteyi Gör <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ActivityRow({
  event,
  isUnread,
  onNavigate,
}: {
  event: ActivityEvent;
  isUnread: boolean;
  onNavigate: () => void;
}) {
  const meta = EVENT_META[event.event_type];
  if (!meta) return null;
  const tone = TONE_CLASSES[meta.tone];
  const Icon = meta.icon;
  const detail = meta.detail?.(event);
  const href = meta.href?.(event);

  const content = (
    <div className="flex items-start gap-3 px-4 py-2.5 hover:bg-muted/40 transition cursor-pointer">
      {isUnread && (
        <span className="size-1.5 rounded-full bg-blue-500 shrink-0 mt-2 -mr-1.5" />
      )}
      <div
        className={cn(
          "size-8 rounded-lg flex items-center justify-center shrink-0",
          tone.bg,
          tone.text,
        )}
      >
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm leading-tight">
          <span className="font-semibold">{event.actor_name || "Sistem"}</span>{" "}
          <span className="text-muted-foreground">{meta.verb(event)}</span>{" "}
          {event.entity_label && (
            <span className="font-medium">{event.entity_label}</span>
          )}
        </div>
        {detail && (
          <div className={cn("text-xs mt-0.5 font-mono tabular-nums", tone.text)}>
            {detail}
          </div>
        )}
        <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
          <span>{relativeTime(event.created_at)}</span>
          <span className="opacity-50">·</span>
          <span>{CATEGORY_LABEL[meta.category]}</span>
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} onClick={onNavigate}>
        {content}
      </Link>
    );
  }
  return <div onClick={onNavigate}>{content}</div>;
}
