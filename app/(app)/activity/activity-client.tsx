"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Check, Search, Inbox } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { markAllActivityRead } from "./actions";
import {
  EVENT_META,
  TONE_CLASSES,
  CATEGORY_LABEL,
  groupEventsByDay,
  relativeTime,
  type ActivityCategory,
} from "@/components/app/activity-config";
import type { ActivityEvent } from "@/lib/supabase/types";
import { cn, formatDateTime } from "@/lib/utils";

const FILTERS: { key: "all" | ActivityCategory; label: string }[] = [
  { key: "all", label: "Tümü" },
  { key: "kalite", label: "Kalite" },
  { key: "is", label: "İşler" },
  { key: "uretim", label: "Üretim" },
  { key: "makine", label: "Makine" },
  { key: "takim", label: "Takım" },
  { key: "operator", label: "Operatör" },
  { key: "resim", label: "Resim" },
  { key: "siparis", label: "Sipariş" },
  { key: "cadcam", label: "CAD/CAM" },
  { key: "kullanici", label: "Kullanıcı" },
];

interface Props {
  initialEvents: ActivityEvent[];
  initialLastReadAt: string | null;
}

export function ActivityClient({ initialEvents, initialLastReadAt }: Props) {
  const [events, setEvents] = useState<ActivityEvent[]>(initialEvents);
  const [lastReadAt, setLastReadAt] = useState<string | null>(initialLastReadAt);
  const [filter, setFilter] = useState<"all" | ActivityCategory>("all");
  const [search, setSearch] = useState("");
  const [marking, startMarking] = useTransition();

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("activity-page")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_events" },
        (payload) => {
          setEvents((prev) => [payload.new as ActivityEvent, ...prev]);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  function onMarkAll() {
    startMarking(async () => {
      const r = await markAllActivityRead();
      if (!r.error) setLastReadAt(new Date().toISOString());
    });
  }

  const filtered = events.filter((e) => {
    const meta = EVENT_META[e.event_type];
    if (!meta) return false;
    if (filter !== "all" && meta.category !== filter) return false;
    if (search) {
      const q = search.toLocaleLowerCase("tr");
      const blob =
        `${e.actor_name ?? ""} ${e.entity_label ?? ""} ${meta.verb(e)}`.toLocaleLowerCase("tr");
      if (!blob.includes(q)) return false;
    }
    return true;
  });

  const grouped = groupEventsByDay(filtered);
  const unreadCount = events.filter(
    (e) => !lastReadAt || new Date(e.created_at) > new Date(lastReadAt),
  ).length;

  return (
    <>
      {/* Top bar: filters + search + mark all */}
      <div className="border-b p-3 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
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
        </div>
        <div className="ml-auto flex items-center gap-2 flex-1 sm:flex-none min-w-[12rem]">
          <div className="relative flex-1">
            <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ara..."
              className="h-8 pl-8 text-sm"
            />
          </div>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={onMarkAll}
              disabled={marking}
              className="h-8 gap-1"
            >
              {marking ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
              Okudum ({unreadCount})
            </Button>
          )}
        </div>
      </div>

      {/* Feed */}
      <div className="max-h-[70vh] overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-16 text-center text-muted-foreground">
            <Inbox className="size-10 mx-auto opacity-30 mb-2" />
            <p className="text-sm">
              {search || filter !== "all" ? "Eşleşen aktivite yok" : "Henüz aktivite yok"}
            </p>
          </div>
        ) : (
          grouped.map((g) => (
            <div key={g.label}>
              <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/40 sticky top-0 z-10">
                {g.label} · {g.items.length}
              </div>
              <div className="divide-y">
                {g.items.map((e) => (
                  <ActivityRow
                    key={e.id}
                    event={e}
                    isUnread={!lastReadAt || new Date(e.created_at) > new Date(lastReadAt)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}

function ActivityRow({
  event,
  isUnread,
}: {
  event: ActivityEvent;
  isUnread: boolean;
}) {
  const meta = EVENT_META[event.event_type];
  if (!meta) return null;
  const tone = TONE_CLASSES[meta.tone];
  const Icon = meta.icon;
  const detail = meta.detail?.(event);
  const href = meta.href?.(event);

  const content = (
    <div className="flex items-start gap-3 px-4 py-3 hover:bg-muted/40 transition">
      {isUnread && (
        <span className="size-1.5 rounded-full bg-blue-500 shrink-0 mt-2.5 -mr-1.5" />
      )}
      <div className={cn("size-9 rounded-lg flex items-center justify-center shrink-0", tone.bg, tone.text)}>
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
        <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-2">
          <span>{relativeTime(event.created_at)}</span>
          <span className="opacity-50">·</span>
          <span className="font-mono tabular-nums">{formatDateTime(event.created_at)}</span>
          <span className="opacity-50">·</span>
          <span>{CATEGORY_LABEL[meta.category]}</span>
        </div>
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}
