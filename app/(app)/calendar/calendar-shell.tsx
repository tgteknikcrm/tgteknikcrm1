"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Plus, CalendarDays } from "lucide-react";
import {
  CALENDAR_COLOR_MAP,
  type CalendarEvent,
  type CalendarEventAttendee,
  type Job,
  type Machine,
  type Profile,
} from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import { EventDialog } from "./event-dialog";
import { cn } from "@/lib/utils";

type View = "month" | "week" | "day";

interface Props {
  view: View;
  anchor: string; // YYYY-MM-DD — initial values, then fully client-driven
  todayISO: string;
  events: CalendarEvent[];
  attendees: CalendarEventAttendee[];
  people: Array<Pick<Profile, "id" | "full_name" | "phone">>;
  jobs: Pick<Job, "id" | "job_no" | "customer" | "part_name" | "status">[];
  machines: Pick<Machine, "id" | "name">[];
  currentUserId: string;
}

// Whole calendar shell is client-state-driven: view + anchor live in
// React state, URL is mirrored via pushState so refresh / share still
// work, and navigation never triggers a server roundtrip. The initial
// payload from page.tsx covers a wide window (~3mo back, 9mo ahead),
// so flipping months/weeks/days is instant.

const TR_MONTHS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];
const TR_WEEKDAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

function isoFromDate(d: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
function addDaysISO(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}
function addMonthsISO(iso: string, n: number) {
  const [y, m] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + n, 1));
  return dt.toISOString().slice(0, 10);
}

export function CalendarShell({
  view: initialView,
  anchor: initialAnchor,
  todayISO,
  events,
  attendees,
  people,
  jobs,
  machines,
  currentUserId,
}: Props) {
  const router = useRouter();
  const [view, setView] = useState<View>(initialView);
  const [anchor, setAnchor] = useState<string>(initialAnchor);
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);
  const [createPrefill, setCreatePrefill] = useState<{
    starts_at: string;
    ends_at: string;
    all_day: boolean;
  } | null>(null);

  // Mirror state into the URL so refresh / share still work, but never
  // trigger a server re-render: pushState is a no-op for Next router.
  const syncUrl = useCallback((nextView: View, nextAnchor: string) => {
    if (typeof window === "undefined") return;
    const url = `/calendar?view=${nextView}&date=${nextAnchor}`;
    window.history.replaceState({}, "", url);
  }, []);

  // Realtime: keep the cached events fresh. Debounced so a burst of
  // RSVP updates only triggers one server fetch.
  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 250);
    };
    const ch = supabase
      .channel("calendar-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calendar_events" },
        schedule,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calendar_event_attendees" },
        schedule,
      )
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(ch);
    };
  }, [router]);

  function navigate(direction: "prev" | "next" | "today") {
    let nextAnchor = anchor;
    if (direction === "today") nextAnchor = todayISO;
    else if (view === "month")
      nextAnchor = addMonthsISO(anchor, direction === "next" ? 1 : -1);
    else if (view === "week")
      nextAnchor = addDaysISO(anchor, direction === "next" ? 7 : -7);
    else nextAnchor = addDaysISO(anchor, direction === "next" ? 1 : -1);
    setAnchor(nextAnchor);
    syncUrl(view, nextAnchor);
  }
  function changeView(v: View) {
    setView(v);
    syncUrl(v, anchor);
  }

  const titleLabel = useMemo(() => {
    const [y, m, d] = anchor.split("-").map(Number);
    if (view === "month") return `${TR_MONTHS[m - 1]} ${y}`;
    if (view === "week") {
      const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
      const start = addDaysISO(anchor, -dow);
      const end = addDaysISO(start, 6);
      return `${formatShortDate(start)} – ${formatShortDate(end)}`;
    }
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("tr-TR", {
      timeZone: "Europe/Istanbul",
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }, [view, anchor]);

  const peopleMap = useMemo(
    () => new Map(people.map((p) => [p.id, p])),
    [people],
  );
  const attendeesByEvent = useMemo(() => {
    const m = new Map<string, CalendarEventAttendee[]>();
    for (const a of attendees) {
      const arr = m.get(a.event_id) ?? [];
      arr.push(a);
      m.set(a.event_id, arr);
    }
    return m;
  }, [attendees]);

  function openCreate(at?: { starts_at: string; ends_at: string; all_day: boolean }) {
    setCreatePrefill(at ?? null);
  }

  return (
    <div className="-m-4 md:-m-6 lg:-m-8 h-[calc(100vh-3.5rem)] flex flex-col bg-background">
      {/* Header toolbar */}
      <div className="px-3 sm:px-4 py-2 border-b flex items-center gap-2 flex-wrap bg-card/30 backdrop-blur-sm">
        <CalendarDays className="size-5 text-primary shrink-0" />
        <h1 className="font-bold text-base sm:text-lg">Takvim</h1>

        <div className="ml-2 flex items-center gap-0.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("today")}
            className="h-8"
          >
            Bugün
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("prev")}
            className="size-8"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("next")}
            className="size-8"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <div className="font-semibold text-sm sm:text-base ml-1 first-letter:uppercase">
          {titleLabel}
        </div>

        <div className="ml-auto flex items-center gap-1">
          <ViewSwitcher view={view} onChange={changeView} />
          <EventDialog
            currentUserId={currentUserId}
            people={people}
            jobs={jobs}
            machines={machines}
            event={editEvent}
            prefill={createPrefill}
            onClose={() => {
              setEditEvent(null);
              setCreatePrefill(null);
            }}
            trigger={
              <Button size="sm" className="h-8 gap-1.5">
                <Plus className="size-4" /> Yeni Etkinlik
              </Button>
            }
          />
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {view === "month" && (
          <MonthView
            anchor={anchor}
            todayISO={todayISO}
            events={events}
            attendeesByEvent={attendeesByEvent}
            peopleMap={peopleMap}
            onEventClick={(e) => setEditEvent(e)}
            onDayClick={(iso) =>
              openCreate({
                starts_at: `${iso}T09:00:00`,
                ends_at: `${iso}T10:00:00`,
                all_day: false,
              })
            }
          />
        )}
        {view === "week" && (
          <WeekView
            anchor={anchor}
            todayISO={todayISO}
            events={events}
            attendeesByEvent={attendeesByEvent}
            peopleMap={peopleMap}
            onEventClick={(e) => setEditEvent(e)}
            onSlotClick={(iso, hour) =>
              openCreate({
                starts_at: `${iso}T${String(hour).padStart(2, "0")}:00:00`,
                ends_at: `${iso}T${String(hour + 1).padStart(2, "0")}:00:00`,
                all_day: false,
              })
            }
          />
        )}
        {view === "day" && (
          <DayView
            anchor={anchor}
            todayISO={todayISO}
            events={events}
            attendeesByEvent={attendeesByEvent}
            peopleMap={peopleMap}
            onEventClick={(e) => setEditEvent(e)}
            onSlotClick={(hour) =>
              openCreate({
                starts_at: `${anchor}T${String(hour).padStart(2, "0")}:00:00`,
                ends_at: `${anchor}T${String(hour + 1).padStart(2, "0")}:00:00`,
                all_day: false,
              })
            }
          />
        )}
      </div>
    </div>
  );
}

function ViewSwitcher({
  view,
  onChange,
}: {
  view: View;
  onChange: (v: View) => void;
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border bg-card p-0.5 shadow-sm">
      {(["month", "week", "day"] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cn(
            "px-2.5 py-1 rounded-md text-xs font-medium transition",
            view === v
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {v === "month" ? "Ay" : v === "week" ? "Hafta" : "Gün"}
        </button>
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Month view — 6×7 grid, day cells with up to 3 events + "+N more".
   ────────────────────────────────────────────────────────────────── */

function MonthView({
  anchor,
  todayISO,
  events,
  attendeesByEvent,
  peopleMap,
  onEventClick,
  onDayClick,
}: {
  anchor: string;
  todayISO: string;
  events: CalendarEvent[];
  attendeesByEvent: Map<string, CalendarEventAttendee[]>;
  peopleMap: Map<string, Pick<Profile, "id" | "full_name" | "phone">>;
  onEventClick: (e: CalendarEvent) => void;
  onDayClick: (iso: string) => void;
}) {
  const [y, m] = anchor.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const dow = (first.getUTCDay() + 6) % 7;
  const startISO = addDaysISO(`${y}-${String(m).padStart(2, "0")}-01`, -dow);

  const days: string[] = [];
  for (let i = 0; i < 42; i++) days.push(addDaysISO(startISO, i));

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const iso = e.starts_at.slice(0, 10);
      const arr = map.get(iso) ?? [];
      arr.push(e);
      map.set(iso, arr);
    }
    return map;
  }, [events]);

  void peopleMap;
  void attendeesByEvent;

  return (
    <div className="h-full flex flex-col">
      <div className="grid grid-cols-7 border-b text-[11px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/30">
        {TR_WEEKDAYS.map((d) => (
          <div key={d} className="px-2 py-1.5 text-center">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 grid-rows-6 flex-1">
        {days.map((iso) => {
          const [, mm] = iso.split("-").map(Number);
          const isCurrentMonth = mm === m;
          const isToday = iso === todayISO;
          const dayNum = Number(iso.slice(8, 10));
          const dayEvents = eventsByDay.get(iso) ?? [];
          const visible = dayEvents.slice(0, 3);
          const more = dayEvents.length - visible.length;
          return (
            <div
              key={iso}
              role="button"
              tabIndex={0}
              onClick={() => onDayClick(iso)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onDayClick(iso);
                }
              }}
              className={cn(
                "border-r border-b p-1 text-left flex flex-col gap-1 min-w-0 overflow-hidden cursor-pointer",
                "hover:bg-muted/40 transition group/day",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                !isCurrentMonth && "bg-muted/10 text-muted-foreground/60",
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "text-xs font-bold tabular-nums size-6 rounded-full flex items-center justify-center",
                    isToday && "bg-primary text-primary-foreground",
                  )}
                >
                  {dayNum}
                </span>
                {more > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    +{more}
                  </span>
                )}
              </div>
              <div className="space-y-0.5 min-w-0">
                {visible.map((e) => (
                  <EventChip
                    key={e.id}
                    event={e}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onEventClick(e);
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EventChip({
  event,
  onClick,
}: {
  event: CalendarEvent;
  onClick: (e: React.MouseEvent) => void;
}) {
  const tone = CALENDAR_COLOR_MAP[event.color];
  const time = event.all_day
    ? null
    : new Date(event.starts_at).toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Istanbul",
      });
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left px-1.5 py-0.5 rounded text-[10px] font-medium truncate transition",
        "hover:scale-[1.02] flex items-center gap-1",
        event.all_day ? `${tone.bg} text-white` : `${tone.bgSoft}`,
      )}
    >
      {!event.all_day && (
        <span className={cn("size-1.5 rounded-full shrink-0", tone.dot)} />
      )}
      {time && <span className="tabular-nums opacity-80">{time}</span>}
      <span className="truncate">{event.title}</span>
    </button>
  );
}

function formatShortDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/* ──────────────────────────────────────────────────────────────────
   Week / Day view — hour grid 7→22 with events as positioned blocks.
   ────────────────────────────────────────────────────────────────── */

const HOUR_START = 7;
const HOUR_END = 22;
const HOURS = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => i + HOUR_START);
const SLOT_HEIGHT = 48; // px per hour

function WeekView(props: {
  anchor: string;
  todayISO: string;
  events: CalendarEvent[];
  attendeesByEvent: Map<string, CalendarEventAttendee[]>;
  peopleMap: Map<string, Pick<Profile, "id" | "full_name" | "phone">>;
  onEventClick: (e: CalendarEvent) => void;
  onSlotClick: (iso: string, hour: number) => void;
}) {
  const { anchor, todayISO, events, onEventClick, onSlotClick } = props;
  const [y, m, d] = anchor.split("-").map(Number);
  const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
  const startISO = addDaysISO(anchor, -dow);
  const days = Array.from({ length: 7 }, (_, i) => addDaysISO(startISO, i));

  return (
    <div className="h-full flex flex-col">
      <div className="grid grid-cols-[3rem_repeat(7,1fr)] border-b">
        <div />
        {days.map((iso) => {
          const [yy, mm, dd] = iso.split("-").map(Number);
          const isToday = iso === todayISO;
          const wd = (new Date(Date.UTC(yy, mm - 1, dd)).getUTCDay() + 6) % 7;
          return (
            <div
              key={iso}
              className="px-2 py-1 text-center border-l first:border-l-0"
            >
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {TR_WEEKDAYS[wd]}
              </div>
              <div
                className={cn(
                  "text-lg font-bold tabular-nums size-8 rounded-full mx-auto flex items-center justify-center",
                  isToday && "bg-primary text-primary-foreground",
                )}
              >
                {dd}
              </div>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-[3rem_repeat(7,1fr)] flex-1 overflow-y-auto relative">
        <HourLabels />
        {days.map((iso) => (
          <DayColumn
            key={iso}
            iso={iso}
            events={events.filter((e) => e.starts_at.slice(0, 10) === iso)}
            onEventClick={onEventClick}
            onSlotClick={onSlotClick}
          />
        ))}
      </div>
    </div>
  );
}

function DayView(props: {
  anchor: string;
  todayISO: string;
  events: CalendarEvent[];
  attendeesByEvent: Map<string, CalendarEventAttendee[]>;
  peopleMap: Map<string, Pick<Profile, "id" | "full_name" | "phone">>;
  onEventClick: (e: CalendarEvent) => void;
  onSlotClick: (hour: number) => void;
}) {
  const { anchor, events, onEventClick, onSlotClick } = props;
  return (
    <div className="h-full flex flex-col">
      <div className="grid grid-cols-[3rem_1fr] flex-1 overflow-y-auto">
        <HourLabels />
        <DayColumn
          iso={anchor}
          events={events.filter((e) => e.starts_at.slice(0, 10) === anchor)}
          onEventClick={onEventClick}
          onSlotClick={(_, h) => onSlotClick(h)}
        />
      </div>
    </div>
  );
}

function HourLabels() {
  return (
    <div className="border-r">
      {HOURS.map((h) => (
        <div
          key={h}
          className="text-[10px] text-muted-foreground text-right pr-1.5 font-mono tabular-nums"
          style={{ height: SLOT_HEIGHT }}
        >
          {String(h).padStart(2, "0")}:00
        </div>
      ))}
    </div>
  );
}

function DayColumn({
  iso,
  events,
  onEventClick,
  onSlotClick,
}: {
  iso: string;
  events: CalendarEvent[];
  onEventClick: (e: CalendarEvent) => void;
  onSlotClick: (iso: string, hour: number) => void;
}) {
  return (
    <div className="relative border-l first:border-l-0">
      {HOURS.map((h) => (
        <button
          key={h}
          type="button"
          onClick={() => onSlotClick(iso, h)}
          className="block w-full border-b border-dashed border-muted hover:bg-muted/30 transition"
          style={{ height: SLOT_HEIGHT }}
        />
      ))}
      {events
        .filter((e) => !e.all_day)
        .map((e) => {
          const tone = CALENDAR_COLOR_MAP[e.color];
          const start = new Date(e.starts_at);
          const end = new Date(e.ends_at);
          const startHours =
            Number(
              new Intl.DateTimeFormat("en-GB", {
                timeZone: "Europe/Istanbul",
                hour: "2-digit",
                hour12: false,
              }).format(start),
            ) +
            Number(
              new Intl.DateTimeFormat("en-GB", {
                timeZone: "Europe/Istanbul",
                minute: "2-digit",
              }).format(start),
            ) /
              60;
          const endHours =
            Number(
              new Intl.DateTimeFormat("en-GB", {
                timeZone: "Europe/Istanbul",
                hour: "2-digit",
                hour12: false,
              }).format(end),
            ) +
            Number(
              new Intl.DateTimeFormat("en-GB", {
                timeZone: "Europe/Istanbul",
                minute: "2-digit",
              }).format(end),
            ) /
              60;
          const top = Math.max(0, (startHours - HOUR_START) * SLOT_HEIGHT);
          const height = Math.max(
            18,
            (endHours - startHours) * SLOT_HEIGHT - 2,
          );
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => onEventClick(e)}
              className={cn(
                "absolute left-0.5 right-0.5 rounded-md px-1.5 py-0.5 text-left",
                "border-l-4 shadow-sm overflow-hidden text-[11px] transition hover:shadow-md hover:scale-[1.01]",
                tone.bgSoft,
                tone.border,
              )}
              style={{ top, height }}
            >
              <div className="font-semibold truncate">{e.title}</div>
              <div className="text-[10px] opacity-70 tabular-nums">
                {start.toLocaleTimeString("tr-TR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "Europe/Istanbul",
                })}
                {" – "}
                {end.toLocaleTimeString("tr-TR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "Europe/Istanbul",
                })}
              </div>
            </button>
          );
        })}
      {/* All-day strip for non-month views */}
      {events.filter((e) => e.all_day).length > 0 && (
        <div className="absolute top-0 left-0 right-0 px-1 py-0.5 space-y-0.5 z-10">
          {events
            .filter((e) => e.all_day)
            .map((e) => {
              const tone = CALENDAR_COLOR_MAP[e.color];
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => onEventClick(e)}
                  className={cn(
                    "w-full text-left px-1.5 py-0.5 rounded text-[10px] font-semibold truncate text-white",
                    tone.bg,
                  )}
                >
                  📌 {e.title}
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}
