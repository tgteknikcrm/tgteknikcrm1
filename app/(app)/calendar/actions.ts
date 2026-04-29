"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type {
  CalendarAttendeeStatus,
  CalendarEventColor,
} from "@/lib/supabase/types";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null as never, error: "Giriş gerekli" };
  return { supabase, user };
}

export interface SaveEventInput {
  id?: string;
  title: string;
  description?: string | null;
  location?: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  color: CalendarEventColor;
  job_id?: string | null;
  machine_id?: string | null;
  attendee_ids: string[];
}

export async function saveCalendarEvent(input: SaveEventInput) {
  const { supabase, user, error } = await requireUser();
  if (error) return { error };
  const title = input.title.trim();
  if (!title) return { error: "Başlık gerekli" };
  if (new Date(input.ends_at) < new Date(input.starts_at)) {
    return { error: "Bitiş tarihi başlangıçtan önce olamaz" };
  }

  const payload = {
    title,
    description: input.description?.trim() || null,
    location: input.location?.trim() || null,
    starts_at: input.starts_at,
    ends_at: input.ends_at,
    all_day: input.all_day,
    color: input.color,
    job_id: input.job_id || null,
    machine_id: input.machine_id || null,
    created_by: user.id,
  };

  let eventId = input.id ?? null;
  if (eventId) {
    const { error: e } = await supabase
      .from("calendar_events")
      .update(payload)
      .eq("id", eventId);
    if (e) return { error: e.message };
  } else {
    const { data, error: e } = await supabase
      .from("calendar_events")
      .insert(payload)
      .select("id")
      .single();
    if (e || !data) return { error: e?.message ?? "Etkinlik oluşturulamadı" };
    eventId = data.id;
  }

  // Sync attendees: replace existing set with new set (simplest, fine
  // for our scale). Always include the creator as accepted so it shows
  // up in their own calendar even before others respond.
  const desired = new Set<string>(input.attendee_ids);
  desired.add(user.id);

  await supabase.from("calendar_event_attendees").delete().eq("event_id", eventId);
  const rows = Array.from(desired).map((uid) => ({
    event_id: eventId!,
    user_id: uid,
    status: uid === user.id ? "accepted" : "pending",
    responded_at: uid === user.id ? new Date().toISOString() : null,
  }));
  const { error: aErr } = await supabase
    .from("calendar_event_attendees")
    .insert(rows);
  if (aErr) return { error: aErr.message };

  revalidatePath("/calendar");
  return { id: eventId };
}

export async function deleteCalendarEvent(id: string) {
  const { supabase, error } = await requireUser();
  if (error) return { error };
  const { error: e } = await supabase
    .from("calendar_events")
    .delete()
    .eq("id", id);
  if (e) return { error: e.message };
  revalidatePath("/calendar");
  return { success: true };
}

export async function setAttendeeStatus(
  eventId: string,
  status: CalendarAttendeeStatus,
) {
  const { supabase, user, error } = await requireUser();
  if (error) return { error };
  const { error: e } = await supabase
    .from("calendar_event_attendees")
    .update({ status, responded_at: new Date().toISOString() })
    .eq("event_id", eventId)
    .eq("user_id", user.id);
  if (e) return { error: e.message };
  revalidatePath("/calendar");
  return { success: true };
}
