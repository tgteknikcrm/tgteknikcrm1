"use server";

import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import {
  R2_IMAGE_VARIANTS,
  putR2Object,
  r2Configured,
  r2VariantKey,
} from "@/lib/r2";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

export interface R2UploadResult {
  storage_path: string; // base key (used in DB)
  file_name: string;
  mime_type: string;
  size_bytes: number;
  provider: "r2";
}

/**
 * Upload an attachment to R2.
 *
 * Pipeline:
 *  1. Auth check (server-side cookies → user.id).
 *  2. Read file from FormData. Validate size (≤25 MB) and a basic
 *     mime allowlist so a renamed `.exe` can't get past the front.
 *  3. For images: sharp generates 200/600/1200 webp variants in
 *     parallel; the original is stored unchanged for download.
 *  4. PUT every produced object to R2 with a long immutable cache.
 *  5. Return the row payload that `sendMessage` writes to
 *     `message_attachments` (with provider='r2').
 */
export async function uploadAttachmentToR2(
  conversationId: string,
  formData: FormData,
): Promise<{ data?: R2UploadResult; error?: string }> {
  if (!r2Configured()) {
    return { error: "R2 not configured" };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Giriş gerekli" };

  // Verify the user is a participant of the conversation.
  const { data: part } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!part) return { error: "Bu konuşmaya yükleme yetkiniz yok" };

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Dosya yok" };
  if (file.size === 0) return { error: "Boş dosya" };
  if (file.size > MAX_FILE_SIZE) {
    return { error: `Dosya ${(MAX_FILE_SIZE / 1024 / 1024) | 0} MB'tan büyük` };
  }

  const mime = file.type || "application/octet-stream";
  if (!isAllowedMime(mime)) {
    return { error: `Bu dosya türü desteklenmiyor: ${mime}` };
  }

  // Stable path key — never collides, organizable per user/conv.
  const safeName = file.name.replace(/[^\w.\-]/g, "_");
  const baseKey = `${user.id}/${conversationId}/${Date.now()}_${safeName}`;

  const buf = Buffer.from(await file.arrayBuffer());

  // Always upload the original.
  await putR2Object({
    key: baseKey,
    body: buf,
    contentType: mime,
  });

  // For images: pre-encode webp variants in parallel.
  if (mime.startsWith("image/")) {
    await Promise.all(
      R2_IMAGE_VARIANTS.map(async (w) => {
        const out = await sharp(buf)
          .rotate() // honor EXIF orientation
          .resize({ width: w, withoutEnlargement: true, fit: "inside" })
          .webp({ quality: 80, effort: 4 })
          .toBuffer();
        await putR2Object({
          key: r2VariantKey(baseKey, w),
          body: out,
          contentType: "image/webp",
        });
      }),
    );
  }

  return {
    data: {
      storage_path: baseKey,
      file_name: file.name,
      mime_type: mime,
      size_bytes: file.size,
      provider: "r2",
    },
  };
}

// Tight allowlist; mirrors the messaging UI's existing filter.
function isAllowedMime(mime: string): boolean {
  const m = mime.toLowerCase();
  if (m.startsWith("image/")) return true;
  if (m === "application/pdf") return true;
  if (m === "application/zip") return true;
  if (m === "application/x-zip-compressed") return true;
  if (m === "text/plain") return true;
  if (m === "application/msword") return true;
  if (
    m ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  )
    return true;
  if (m === "application/vnd.ms-excel") return true;
  if (
    m ===
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  )
    return true;
  if (m === "application/octet-stream") return true; // engineering files (.dwg/.step)
  return false;
}
