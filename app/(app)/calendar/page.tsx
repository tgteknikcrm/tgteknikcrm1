import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import { CalendarShell } from "./calendar-shell";
import type {
  CalendarEvent,
  CalendarEventAttendee,
  Job,
  Machine,
  Profile,
} from "@/lib/supabase/types";

export const metadata = { title: "Takvim" };

type CalView = "month" | "week" | "day";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string }>;
}) {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  const sp = await searchParams;
  const view: CalView =
    sp.view === "week" || sp.view === "day" ? sp.view : "month";
  // Anchor date — defaults to today (TR). YYYY-MM-DD.
  const todayTR = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const anchor = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todayTR;

  // Wide initial window so the shell can navigate months/weeks/days
  // without ever round-tripping the server. We pull 3 months back to
  // 9 months forward — that covers the typical user's calendar working
  // set and keeps client-side navigation instant.
  const [y, m] = anchor.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1 - 3, 1));
  const to = new Date(Date.UTC(y, m - 1 + 9, 1));

  const supabase = await createClient();
  const [eventsRes, attendeesRes, peopleRes, jobsRes, machinesRes] = await Promise.all([
    supabase
      .from("calendar_events")
      .select("*")
      .gte("starts_at", from.toISOString())
      .lt("starts_at", to.toISOString())
      .order("starts_at", { ascending: true }),
    supabase
      .from("calendar_event_attendees")
      .select("*"),
    supabase
      .from("profiles")
      .select("id, full_name, phone")
      .eq("active", true)
      .order("full_name"),
    supabase
      .from("jobs")
      .select("id, job_no, customer, part_name, status")
      .in("status", ["beklemede", "uretimde"])
      .order("created_at", { ascending: false })
      .limit(80),
    supabase.from("machines").select("id, name").order("name"),
  ]);

  const events = (eventsRes.data ?? []) as CalendarEvent[];
  const eventIds = new Set(events.map((e) => e.id));
  const attendees = ((attendeesRes.data ?? []) as CalendarEventAttendee[]).filter(
    (a) => eventIds.has(a.event_id),
  );
  const people = (peopleRes.data ?? []) as Array<
    Pick<Profile, "id" | "full_name" | "phone">
  >;
  const jobs = (jobsRes.data ?? []) as Pick<
    Job,
    "id" | "job_no" | "customer" | "part_name" | "status"
  >[];
  const machines = (machinesRes.data ?? []) as Pick<Machine, "id" | "name">[];

  return (
    <CalendarShell
      view={view}
      anchor={anchor}
      todayISO={todayTR}
      events={events}
      attendees={attendees}
      people={people}
      jobs={jobs}
      machines={machines}
      currentUserId={profile.id}
    />
  );
}
