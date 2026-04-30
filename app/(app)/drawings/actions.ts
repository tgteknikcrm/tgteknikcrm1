"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { recordEvent } from "@/lib/activity";

export async function uploadDrawing(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Giriş yapılmamış" };

  const file = formData.get("file") as File | null;
  const title = String(formData.get("title") ?? "").trim();
  const jobId = String(formData.get("job_id") ?? "").trim();
  const productId = String(formData.get("product_id") ?? "").trim();
  const revision = String(formData.get("revision") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!file || file.size === 0) return { error: "Dosya seçilmedi" };
  if (!title) return { error: "Başlık zorunlu" };

  const ts = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const path = `${user.id}/${ts}_${safeName}`;

  const { error: upErr } = await supabase.storage
    .from("drawings")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) return { error: "Dosya yüklenemedi: " + upErr.message };

  const { data: ins, error: insErr } = await supabase
    .from("drawings")
    .insert({
      job_id: jobId || null,
      product_id: productId || null,
      title,
      file_path: path,
      file_type: file.type,
      file_size: file.size,
      revision: revision || null,
      notes: notes || null,
      uploaded_by: user.id,
    })
    .select("id")
    .single();
  if (insErr) {
    await supabase.storage.from("drawings").remove([path]);
    return { error: insErr.message };
  }

  await recordEvent({
    type: "drawing.uploaded",
    entity_type: "drawing",
    entity_id: ins.id as string,
    entity_label: title,
    metadata: { revision: revision || null, file_type: file.type },
  });

  revalidatePath("/drawings");
  return { success: true };
}

export async function deleteDrawing(id: string, path: string) {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("drawings")
    .select("title")
    .eq("id", id)
    .single();
  const { error: delErr } = await supabase.from("drawings").delete().eq("id", id);
  if (delErr) return { error: delErr.message };
  await supabase.storage.from("drawings").remove([path]);
  await recordEvent({
    type: "drawing.deleted",
    entity_type: "drawing",
    entity_id: id,
    entity_label: existing?.title ?? null,
  });
  revalidatePath("/drawings");
  return { success: true };
}

export async function getSignedUrl(path: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("drawings")
    .createSignedUrl(path, 60 * 10); // 10 minutes
  if (error) return { error: error.message };
  return { url: data.signedUrl };
}

// Persist Fabric.js canvas state JSON. Original storage file is untouched.
export async function saveAnnotations(drawingId: string, annotations: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Giriş yapılmamış" };

  const { error } = await supabase
    .from("drawings")
    .update({
      annotations,
      annotated_at: new Date().toISOString(),
      annotated_by: user.id,
    })
    .eq("id", drawingId);
  if (error) return { error: error.message };

  const { data: dInfo } = await supabase
    .from("drawings")
    .select("title")
    .eq("id", drawingId)
    .single();
  await recordEvent({
    type: "drawing.annotated",
    entity_type: "drawing",
    entity_id: drawingId,
    entity_label: dInfo?.title ?? null,
  });

  revalidatePath("/drawings");
  return { success: true };
}

export async function clearAnnotations(drawingId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("drawings")
    .update({ annotations: null, annotated_at: null, annotated_by: null })
    .eq("id", drawingId);
  if (error) return { error: error.message };
  revalidatePath("/drawings");
  return { success: true };
}
