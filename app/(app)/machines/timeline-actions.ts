"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { TimelineEntryKind } from "@/lib/supabase/types";

async function snapshotAuthor(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("full_name, phone")
    .eq("id", user.id)
    .single();
  return {
    id: user.id,
    name: data?.full_name || data?.phone || null,
  };
}

export async function createTimelineEntry(input: {
  machine_id: string;
  kind: TimelineEntryKind;
  title?: string;
  body?: string;
  photo_paths?: string[];
  duration_minutes?: number | null;
  happened_at?: string;
}) {
  const supabase = await createClient();
  const author = await snapshotAuthor(supabase);
  if (!author) return { error: "Giriş yapılmamış" };

  if (!input.body?.trim() && !input.title?.trim() && (input.photo_paths?.length ?? 0) === 0) {
    return { error: "Boş kayıt olamaz — başlık, metin veya fotoğraf gerekli." };
  }

  const { error } = await supabase.from("machine_timeline_entries").insert({
    machine_id: input.machine_id,
    author_id: author.id,
    author_name: author.name,
    kind: input.kind,
    title: input.title?.trim() || null,
    body: input.body?.trim() || null,
    photo_paths: input.photo_paths ?? [],
    duration_minutes: input.duration_minutes ?? null,
    happened_at: input.happened_at || new Date().toISOString(),
  });
  if (error) return { error: error.message };

  revalidatePath(`/machines/${input.machine_id}`);
  return { success: true };
}

export async function deleteTimelineEntry(id: string, machineId: string) {
  const supabase = await createClient();

  // Cleanup photo files (best-effort)
  const { data: existing } = await supabase
    .from("machine_timeline_entries")
    .select("photo_paths")
    .eq("id", id)
    .single();
  const paths = (existing?.photo_paths ?? []) as string[];
  if (paths.length > 0) {
    await supabase.storage.from("timeline-photos").remove(paths);
  }

  const { error } = await supabase
    .from("machine_timeline_entries")
    .delete()
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/machines/${machineId}`);
  return { success: true };
}

export async function addTimelineComment(input: {
  entry_id: string;
  body: string;
  machine_id: string;
}) {
  const supabase = await createClient();
  const author = await snapshotAuthor(supabase);
  if (!author) return { error: "Giriş yapılmamış" };
  const body = input.body.trim();
  if (!body) return { error: "Yorum boş olamaz" };

  const { error } = await supabase.from("timeline_comments").insert({
    entry_id: input.entry_id,
    author_id: author.id,
    author_name: author.name,
    body,
  });
  if (error) return { error: error.message };

  revalidatePath(`/machines/${input.machine_id}`);
  return { success: true };
}

export async function deleteTimelineComment(id: string, machineId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("timeline_comments").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/machines/${machineId}`);
  return { success: true };
}

export async function toggleTimelineReaction(input: {
  entry_id: string;
  kind: "like" | "dislike";
  machine_id: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Giriş yapılmamış" };

  // Existing reaction by this user on this entry?
  const { data: existing } = await supabase
    .from("timeline_reactions")
    .select("id, kind")
    .eq("entry_id", input.entry_id)
    .eq("author_id", user.id)
    .maybeSingle();

  if (existing) {
    if (existing.kind === input.kind) {
      // Same kind tapped again → remove
      const { error } = await supabase
        .from("timeline_reactions")
        .delete()
        .eq("id", existing.id);
      if (error) return { error: error.message };
    } else {
      // Different kind → switch
      const { error } = await supabase
        .from("timeline_reactions")
        .update({ kind: input.kind })
        .eq("id", existing.id);
      if (error) return { error: error.message };
    }
  } else {
    const { error } = await supabase.from("timeline_reactions").insert({
      entry_id: input.entry_id,
      author_id: user.id,
      kind: input.kind,
    });
    if (error) return { error: error.message };
  }

  revalidatePath(`/machines/${input.machine_id}`);
  return { success: true };
}
