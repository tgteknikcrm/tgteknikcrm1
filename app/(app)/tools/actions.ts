"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { recordEvent } from "@/lib/activity";
import type { ToolCondition } from "@/lib/supabase/types";

export async function saveTool(input: {
  id?: string;
  code?: string;
  name: string;
  type?: string;
  size?: string;
  material?: string;
  location?: string;
  quantity: number;
  min_quantity: number;
  condition: ToolCondition;
  supplier?: string;
  price?: number | null;
  notes?: string;
}): Promise<{ success?: boolean; id?: string; error?: string }> {
  const supabase = await createClient();
  const payload = {
    code: input.code || null,
    name: input.name,
    type: input.type || null,
    size: input.size || null,
    material: input.material || null,
    location: input.location || null,
    quantity: input.quantity,
    min_quantity: input.min_quantity,
    condition: input.condition,
    supplier: input.supplier || null,
    price: input.price ?? null,
    notes: input.notes || null,
  };
  if (input.id) {
    const { error } = await supabase
      .from("tools")
      .update(payload)
      .eq("id", input.id);
    if (error) return { error: error.message };
    revalidatePath("/tools");
    revalidatePath("/dashboard");
    return { success: true, id: input.id };
  } else {
    const { data, error } = await supabase
      .from("tools")
      .insert(payload)
      .select("id")
      .single();
    if (error) return { error: error.message };
    await recordEvent({
      type: "tool.created",
      entity_type: "tool",
      entity_id: data.id as string,
      entity_label: input.name,
      metadata: { code: input.code },
    });
    revalidatePath("/tools");
    revalidatePath("/dashboard");
    return { success: true, id: data.id as string };
  }
}

export async function deleteTool(id: string) {
  const supabase = await createClient();

  // Best-effort image cleanup before row delete.
  const { data: tool } = await supabase
    .from("tools")
    .select("image_path, name")
    .eq("id", id)
    .single();
  if (tool?.image_path) {
    await supabase.storage.from("tool-images").remove([tool.image_path]);
  }

  const { error } = await supabase.from("tools").delete().eq("id", id);
  if (error) {
    const { humanizeDeleteError } = await import("@/lib/delete-helpers");
    return { error: humanizeDeleteError(error.message, "takım") };
  }
  await recordEvent({
    type: "tool.deleted",
    entity_type: "tool",
    entity_id: id,
    entity_label: tool?.name ?? null,
  });
  revalidatePath("/tools");
  return { success: true };
}

export async function bulkDeleteTools(ids: string[]) {
  if (!ids || ids.length === 0) return { error: "Seçili takım yok" };
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("tools")
    .select("id, image_path")
    .in("id", ids);
  const { error } = await supabase.from("tools").delete().in("id", ids);
  if (error) {
    const { humanizeDeleteError } = await import("@/lib/delete-helpers");
    return { error: humanizeDeleteError(error.message, "takımlar") };
  }
  const paths = (rows ?? [])
    .map((r) => r.image_path)
    .filter((p): p is string => !!p);
  if (paths.length > 0) {
    void supabase.storage.from("tool-images").remove(paths);
  }
  revalidatePath("/tools");
  return { success: true };
}

// Upload a new image for a tool. Replaces the previous image if one exists.
// Path: {user_id}/{tool_id}/{timestamp}_{safeName}
export async function setToolImage(toolId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Giriş yapılmamış" };

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "Dosya seçilmedi" };
  if (!file.type.startsWith("image/")) {
    return { error: "Sadece görsel dosyaları yüklenebilir." };
  }
  // Cap to 8 MB to keep storage tidy
  if (file.size > 8 * 1024 * 1024) {
    return { error: "Dosya boyutu en fazla 8 MB olabilir." };
  }

  // Look up existing image to remove afterwards (best-effort)
  const { data: existing } = await supabase
    .from("tools")
    .select("image_path")
    .eq("id", toolId)
    .single();

  const ts = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const path = `${user.id}/${toolId}/${ts}_${safeName}`;

  const { error: upErr } = await supabase.storage
    .from("tool-images")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) return { error: "Yüklenemedi: " + upErr.message };

  const { error: updErr } = await supabase
    .from("tools")
    .update({ image_path: path })
    .eq("id", toolId);
  if (updErr) {
    // rollback uploaded file
    await supabase.storage.from("tool-images").remove([path]);
    return { error: updErr.message };
  }

  // Delete the previous image if any (after successful update).
  if (existing?.image_path && existing.image_path !== path) {
    await supabase.storage.from("tool-images").remove([existing.image_path]);
  }

  const { data: toolInfo } = await supabase
    .from("tools")
    .select("name")
    .eq("id", toolId)
    .single();
  await recordEvent({
    type: "tool.image_set",
    entity_type: "tool",
    entity_id: toolId,
    entity_label: toolInfo?.name ?? null,
  });

  revalidatePath("/tools");
  return { success: true, path };
}

export async function removeToolImage(toolId: string) {
  const supabase = await createClient();
  const { data: tool } = await supabase
    .from("tools")
    .select("image_path")
    .eq("id", toolId)
    .single();
  if (!tool?.image_path) return { success: true };

  const { error: updErr } = await supabase
    .from("tools")
    .update({ image_path: null })
    .eq("id", toolId);
  if (updErr) return { error: updErr.message };

  await supabase.storage.from("tool-images").remove([tool.image_path]);
  revalidatePath("/tools");
  return { success: true };
}
