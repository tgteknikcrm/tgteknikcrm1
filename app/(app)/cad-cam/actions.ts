"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { recordEvent } from "@/lib/activity";

export async function uploadCadProgram(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Giriş yapılmamış" };

  const file = formData.get("file") as File | null;
  const title = String(formData.get("title") ?? "").trim();
  const machineId = String(formData.get("machine_id") ?? "").trim();
  const jobId = String(formData.get("job_id") ?? "").trim();
  const revision = String(formData.get("revision") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!file || file.size === 0) return { error: "Dosya seçilmedi" };
  if (!title) return { error: "Başlık zorunlu" };

  // Cap to 50 MB. NC programs are tiny but STEP/STL can be larger.
  if (file.size > 50 * 1024 * 1024) {
    return { error: "Dosya boyutu en fazla 50 MB olabilir." };
  }

  const ts = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const path = `${user.id}/${ts}_${safeName}`;

  const { error: upErr } = await supabase.storage
    .from("cad-programs")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) return { error: "Dosya yüklenemedi: " + upErr.message };

  const { data: ins, error: insErr } = await supabase
    .from("cad_programs")
    .insert({
      title,
      machine_id: machineId || null,
      job_id: jobId || null,
      file_path: path,
      file_type: file.type || null,
      file_size: file.size,
      revision: revision || null,
      notes: notes || null,
      uploaded_by: user.id,
    })
    .select("id")
    .single();
  if (insErr) {
    await supabase.storage.from("cad-programs").remove([path]);
    return { error: insErr.message };
  }

  await recordEvent({
    type: "cad.uploaded",
    entity_type: "cad",
    entity_id: ins.id as string,
    entity_label: title,
    metadata: { revision: revision || null, file_type: file.type },
  });

  revalidatePath("/cad-cam");
  return { success: true };
}

export async function deleteCadProgram(id: string, path: string) {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("cad_programs")
    .select("title")
    .eq("id", id)
    .single();
  const { error } = await supabase.from("cad_programs").delete().eq("id", id);
  if (error) return { error: error.message };
  await supabase.storage.from("cad-programs").remove([path]);
  await recordEvent({
    type: "cad.deleted",
    entity_type: "cad",
    entity_id: id,
    entity_label: existing?.title ?? null,
  });
  revalidatePath("/cad-cam");
  return { success: true };
}

export async function getCadSignedUrl(path: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("cad-programs")
    .createSignedUrl(path, 60 * 10); // 10 dk
  if (error) return { error: error.message };
  return { url: data.signedUrl };
}
