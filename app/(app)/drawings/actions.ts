"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function uploadDrawing(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Giriş yapılmamış" };

  const file = formData.get("file") as File | null;
  const title = String(formData.get("title") ?? "").trim();
  const jobId = String(formData.get("job_id") ?? "").trim();
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

  const { error: insErr } = await supabase.from("drawings").insert({
    job_id: jobId || null,
    title,
    file_path: path,
    file_type: file.type,
    file_size: file.size,
    revision: revision || null,
    notes: notes || null,
    uploaded_by: user.id,
  });
  if (insErr) {
    await supabase.storage.from("drawings").remove([path]);
    return { error: insErr.message };
  }

  revalidatePath("/drawings");
  return { success: true };
}

export async function deleteDrawing(id: string, path: string) {
  const supabase = await createClient();
  const { error: delErr } = await supabase.from("drawings").delete().eq("id", id);
  if (delErr) return { error: delErr.message };
  await supabase.storage.from("drawings").remove([path]);
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
