"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  INSPECTION_TEMPLATES,
  type InspectionItem,
  type InspectionType,
  type Shift,
} from "@/lib/supabase/types";

export interface SaveInspectionInput {
  machineId: string;
  type: InspectionType;
  shift: Shift | null;
  items: InspectionItem[];
  notes: string | null;
  photoPaths: string[];
}

export async function saveInspection(input: SaveInspectionInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Giriş gerekli" };

  // Validate items shape — accept either custom items or fall back to
  // template if empty (defensive).
  const items =
    input.items?.length > 0
      ? input.items
      : INSPECTION_TEMPLATES[input.type];

  const { data, error } = await supabase
    .from("machine_inspections")
    .insert({
      machine_id: input.machineId,
      type: input.type,
      performed_by: user.id,
      shift: input.shift,
      items,
      photo_paths: input.photoPaths,
      notes: input.notes?.trim() || null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidatePath(`/machines/${input.machineId}`);
  return { success: true, id: data.id as string };
}

// Upload an inspection photo to the private 'machine-inspections' bucket
// and return its storage path. The caller passes the path back to
// saveInspection in `photoPaths[]`. Path: {user_id}/{machine_id}/{ts}_{name}.
export async function uploadInspectionPhoto(
  machineId: string,
  formData: FormData,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Giriş gerekli" };

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "Dosya seçilmedi" };
  if (!file.type.startsWith("image/")) {
    return { error: "Sadece görsel dosya kabul edilir" };
  }
  if (file.size > 12 * 1024 * 1024) {
    return { error: "Dosya en fazla 12 MB olabilir" };
  }

  const ts = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const path = `${user.id}/${machineId}/${ts}_${safeName}`;

  const { error: upErr } = await supabase.storage
    .from("machine-inspections")
    .upload(path, file, { contentType: file.type });
  if (upErr) return { error: "Yüklenemedi: " + upErr.message };

  return { success: true, path };
}

export async function deleteInspection(id: string, machineId: string) {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("machine_inspections")
    .select("photo_paths")
    .eq("id", id)
    .single();

  const { data, error } = await supabase
    .from("machine_inspections")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Kontrol kaydı silinemedi" };

  // Best-effort photo cleanup
  if (existing?.photo_paths && existing.photo_paths.length > 0) {
    void supabase.storage
      .from("machine-inspections")
      .remove(existing.photo_paths);
  }

  revalidatePath(`/machines/${machineId}`);
  return { success: true };
}

// Resolve signed URLs for an inspection's photo_paths so the UI can
// display them. Signed for 1 hour.
export async function getInspectionPhotoUrls(paths: string[]) {
  if (!paths || paths.length === 0) return { urls: [] as string[] };
  const supabase = await createClient();
  const urls: string[] = [];
  for (const p of paths) {
    const { data } = await supabase.storage
      .from("machine-inspections")
      .createSignedUrl(p, 60 * 60);
    if (data?.signedUrl) urls.push(data.signedUrl);
  }
  return { urls };
}
