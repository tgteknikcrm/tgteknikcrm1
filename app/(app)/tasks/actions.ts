"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { TaskPriority, TaskStatus } from "@/lib/supabase/types";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null as never, error: "Giriş gerekli" };
  return { supabase, user };
}

export interface SaveTaskInput {
  id?: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date?: string | null;
  assigned_to?: string | null;
  job_id?: string | null;
  machine_id?: string | null;
  tags?: string[];
}

export async function saveTask(input: SaveTaskInput) {
  const { supabase, user, error } = await requireUser();
  if (error) return { error };
  const title = input.title.trim();
  if (!title) return { error: "Başlık gerekli" };

  const tags = (input.tags ?? [])
    .map((t) => t.trim().toLocaleLowerCase("tr"))
    .filter((t) => t && /^[a-z0-9_-]{1,20}$/.test(t));

  const payload = {
    title,
    description: input.description?.trim() || null,
    status: input.status,
    priority: input.priority,
    due_date: input.due_date || null,
    assigned_to: input.assigned_to || null,
    job_id: input.job_id || null,
    machine_id: input.machine_id || null,
    tags,
    created_by: user.id,
  };

  if (input.id) {
    const { error: e } = await supabase
      .from("tasks")
      .update(payload)
      .eq("id", input.id);
    if (e) return { error: e.message };
    revalidatePath("/tasks");
    return { id: input.id };
  }
  const { data, error: e } = await supabase
    .from("tasks")
    .insert(payload)
    .select("id")
    .single();
  if (e || !data) return { error: e?.message ?? "Görev oluşturulamadı" };
  revalidatePath("/tasks");
  return { id: data.id };
}

export async function setTaskStatus(id: string, status: TaskStatus) {
  const { supabase, error } = await requireUser();
  if (error) return { error };
  const { error: e } = await supabase
    .from("tasks")
    .update({ status })
    .eq("id", id);
  if (e) return { error: e.message };
  revalidatePath("/tasks");
  return { success: true };
}

export async function deleteTask(id: string) {
  const { supabase, error } = await requireUser();
  if (error) return { error };
  const { error: e } = await supabase.from("tasks").delete().eq("id", id);
  if (e) return { error: e.message };
  revalidatePath("/tasks");
  return { success: true };
}

// ── Checklist ───────────────────────────────────────────────────
export async function addChecklistItem(taskId: string, body: string) {
  const { supabase, error } = await requireUser();
  if (error) return { error };
  if (!body.trim()) return { error: "Boş madde eklenemez" };
  const { data: existing } = await supabase
    .from("task_checklist")
    .select("position")
    .eq("task_id", taskId)
    .order("position", { ascending: false })
    .limit(1);
  const nextPos = ((existing ?? [])[0]?.position ?? -1) + 1;
  const { error: e } = await supabase
    .from("task_checklist")
    .insert({ task_id: taskId, body: body.trim(), position: nextPos });
  if (e) return { error: e.message };
  revalidatePath("/tasks");
  return { success: true };
}

export async function toggleChecklistItem(id: string, done: boolean) {
  const { supabase, error } = await requireUser();
  if (error) return { error };
  const { error: e } = await supabase
    .from("task_checklist")
    .update({ done })
    .eq("id", id);
  if (e) return { error: e.message };
  revalidatePath("/tasks");
  return { success: true };
}

export async function deleteChecklistItem(id: string) {
  const { supabase, error } = await requireUser();
  if (error) return { error };
  const { error: e } = await supabase
    .from("task_checklist")
    .delete()
    .eq("id", id);
  if (e) return { error: e.message };
  revalidatePath("/tasks");
  return { success: true };
}

// ── Comments ────────────────────────────────────────────────────
export async function addTaskComment(taskId: string, body: string) {
  const { supabase, user, error } = await requireUser();
  if (error) return { error };
  if (!body.trim()) return { error: "Boş yorum gönderilemez" };
  const { error: e } = await supabase.from("task_comments").insert({
    task_id: taskId,
    author_id: user.id,
    body: body.trim(),
  });
  if (e) return { error: e.message };
  revalidatePath("/tasks");
  return { success: true };
}
