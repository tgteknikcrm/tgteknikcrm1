"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { recordEvent } from "@/lib/activity";
import type { TimelineEntryKind } from "@/lib/supabase/types";

export type BreakdownSeverity = 0 | 1 | 2 | 3; // düşük/orta/yüksek/kritik
export type EntryStatus = "acik" | "devam" | "cozuldu";

export async function createBreakdown(input: {
  machine_id: string;
  kind: TimelineEntryKind; // ariza, bakim, duzeltme, parca_degisimi, temizlik
  title: string;
  body?: string;
  severity_level?: BreakdownSeverity;
  duration_minutes?: number;
  photo_paths?: string[];
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Giriş yapılmamış" };

  if (!input.title.trim()) return { error: "Başlık gerekli" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone")
    .eq("id", user.id)
    .single();

  // Breakdowns auto-set entry_status = 'acik' so they appear in the open list
  const isIncident = ["ariza", "duzeltme", "parca_degisimi"].includes(input.kind);
  const status: EntryStatus | null = isIncident ? "acik" : null;

  const { data, error } = await supabase
    .from("machine_timeline_entries")
    .insert({
      machine_id: input.machine_id,
      author_id: user.id,
      author_name: profile?.full_name || profile?.phone || null,
      kind: input.kind,
      title: input.title.trim(),
      body: input.body?.trim() || null,
      photo_paths: input.photo_paths ?? [],
      duration_minutes: input.duration_minutes ?? null,
      severity_level: input.severity_level ?? null,
      entry_status: status,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  // Bridge into machine status when severity is high/kritik for ariza:
  // optional — we'll just log activity and let user manually flip status.
  await recordEvent({
    type: input.kind === "ariza" ? "machine.status_changed" : "machine.status_changed",
    entity_type: "machine",
    entity_id: input.machine_id,
    entity_label: null,
    metadata: {
      kind: input.kind,
      breakdown_id: data?.id,
      severity: input.severity_level,
      title: input.title,
    },
  });

  revalidatePath("/breakdowns");
  revalidatePath(`/machines/${input.machine_id}`);
  return { success: true, id: data?.id };
}

export async function updateBreakdownStatus(
  entryId: string,
  status: EntryStatus,
  fixDescription?: string,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Giriş yapılmamış" };

  const updates: Record<string, unknown> = {
    entry_status: status,
  };
  if (status === "cozuldu") {
    updates.resolved_at = new Date().toISOString();
    updates.resolved_by = user.id;
    if (fixDescription?.trim()) updates.fix_description = fixDescription.trim();
  } else {
    updates.resolved_at = null;
    updates.resolved_by = null;
  }

  const { data, error } = await supabase
    .from("machine_timeline_entries")
    .update(updates)
    .eq("id", entryId)
    .select("machine_id")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/breakdowns");
  if (data?.machine_id) revalidatePath(`/machines/${data.machine_id}`);
  return { success: true };
}
