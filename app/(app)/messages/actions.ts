"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const MAX_BODY_LEN = 4000;

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null as never, error: "Giriş gerekli" };
  return { supabase, user };
}

// ── Conversations ─────────────────────────────────────────────────

// Find or create a 1:1 conversation between the current user and `otherUserId`.
//
// Hardened against the modes the workshop has hit on prod:
//  - Returns specific Turkish errors at every step (no raw Postgres bubbling)
//  - Verifies that the participant rows actually landed before claiming
//    success (so the UI doesn't navigate into a half-built conversation)
//  - revalidatePath('/messages') so the conversation list re-fetches and
//    the new entry shows up without an extra refresh
export async function getOrCreateDirectConversation(otherUserId: string) {
  const { supabase, user, error } = await requireUser();
  if (error) return { error };
  if (!otherUserId || otherUserId === user.id) {
    return { error: "Geçersiz kullanıcı seçimi" };
  }

  // 1) Look for an existing direct conversation with both participants.
  const { data: mine, error: mineErr } = await supabase
    .from("conversation_participants")
    .select("conversation_id, conversations!inner(id, kind)")
    .eq("user_id", user.id);
  if (mineErr) return { error: `Konuşma listesi okunamadı: ${mineErr.message}` };
  type Row = { conversation_id: string; conversations: { id: string; kind: string } | null };
  const myDirectConvIds = ((mine ?? []) as unknown as Row[])
    .filter((r) => r.conversations?.kind === "direct")
    .map((r) => r.conversation_id);

  if (myDirectConvIds.length > 0) {
    const { data: shared, error: sharedErr } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", otherUserId)
      .in("conversation_id", myDirectConvIds);
    if (sharedErr) {
      return { error: `Mevcut konuşma kontrolü başarısız: ${sharedErr.message}` };
    }
    const existing = (shared ?? [])[0]?.conversation_id;
    if (existing) {
      revalidatePath("/messages");
      return { id: existing as string };
    }
  }

  // 2) Create a new direct conversation.
  const { data: conv, error: convErr } = await supabase
    .from("conversations")
    .insert({ kind: "direct", created_by: user.id })
    .select("id")
    .single();
  if (convErr || !conv) {
    return {
      error: `Konuşma oluşturulamadı: ${convErr?.message ?? "bilinmeyen hata"}`,
    };
  }

  // 3) Add both participants in one statement (atomic).
  const { error: pErr } = await supabase
    .from("conversation_participants")
    .insert([
      { conversation_id: conv.id, user_id: user.id, role: "admin" },
      { conversation_id: conv.id, user_id: otherUserId, role: "member" },
    ]);
  if (pErr) {
    // Roll back the orphan conversation so the user can retry cleanly.
    await supabase.from("conversations").delete().eq("id", conv.id);
    return {
      error: `Katılımcılar eklenemedi: ${pErr.message}`,
    };
  }

  // 4) Verify the participant rows actually landed (RLS could silently
  //    block the insert and we'd otherwise navigate into a broken conv).
  const { data: verifyParts } = await supabase
    .from("conversation_participants")
    .select("user_id")
    .eq("conversation_id", conv.id);
  if (!verifyParts || verifyParts.length < 2) {
    await supabase.from("conversations").delete().eq("id", conv.id);
    return {
      error:
        "Katılımcı kayıtları doğrulanamadı (yetki problemi olabilir). Tekrar dene.",
    };
  }

  revalidatePath("/messages");
  return { id: conv.id as string };
}

export async function createGroupConversation(input: {
  title: string;
  color?: string;
  memberIds: string[];
}) {
  const { supabase, user, error } = await requireUser();
  if (error) return { error };
  const title = input.title.trim();
  if (!title) return { error: "Grup adı gerekli" };
  const memberIds = Array.from(new Set(input.memberIds.filter((id) => id && id !== user.id)));
  if (memberIds.length === 0) return { error: "En az bir üye seç" };

  const { data: conv, error: convErr } = await supabase
    .from("conversations")
    .insert({
      kind: "group",
      title,
      color: input.color ?? "#3b82f6",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (convErr || !conv) return { error: convErr?.message ?? "Grup oluşturulamadı" };

  const rows = [
    { conversation_id: conv.id, user_id: user.id, role: "admin" as const },
    ...memberIds.map((uid) => ({
      conversation_id: conv.id,
      user_id: uid,
      role: "member" as const,
    })),
  ];
  const { error: pErr } = await supabase.from("conversation_participants").insert(rows);
  if (pErr) return { error: pErr.message };

  revalidatePath("/messages");
  return { id: conv.id as string };
}

export async function renameConversation(conversationId: string, title: string) {
  const { supabase, error } = await requireUser();
  if (error) return { error };
  const trimmed = title.trim();
  if (!trimmed) return { error: "Başlık boş olamaz" };
  const { error: e } = await supabase
    .from("conversations")
    .update({ title: trimmed })
    .eq("id", conversationId);
  if (e) return { error: e.message };
  revalidatePath("/messages");
  return { success: true };
}

export async function setConversationColor(conversationId: string, color: string) {
  const { supabase, error } = await requireUser();
  if (error) return { error };
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return { error: "Geçersiz renk" };
  const { error: e } = await supabase
    .from("conversations")
    .update({ color })
    .eq("id", conversationId);
  if (e) return { error: e.message };
  revalidatePath("/messages");
  return { success: true };
}

export async function addParticipant(conversationId: string, userId: string) {
  const { supabase, error } = await requireUser();
  if (error) return { error };
  const { error: e } = await supabase
    .from("conversation_participants")
    .insert({ conversation_id: conversationId, user_id: userId, role: "member" });
  if (e) return { error: e.message };
  revalidatePath("/messages");
  return { success: true };
}

export async function removeParticipant(conversationId: string, userId: string) {
  const { supabase, error } = await requireUser();
  if (error) return { error };
  const { error: e } = await supabase
    .from("conversation_participants")
    .delete()
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);
  if (e) return { error: e.message };
  revalidatePath("/messages");
  return { success: true };
}

export async function leaveConversation(conversationId: string) {
  const { supabase, user, error } = await requireUser();
  if (error) return { error };
  const { error: e } = await supabase
    .from("conversation_participants")
    .delete()
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id);
  if (e) return { error: e.message };
  revalidatePath("/messages");
  return { success: true };
}

// ── Messages ──────────────────────────────────────────────────────

export async function sendMessage(input: {
  conversationId: string;
  body?: string | null;
  replyTo?: string | null;
  // Each attachment was already uploaded — either via the client SDK
  // to Supabase storage (provider='supabase') or via the R2 server
  // action to Cloudflare R2 (provider='r2'). storage_path is a key in
  // the corresponding bucket.
  attachments?: Array<{
    storage_path: string;
    file_name: string;
    mime_type: string;
    size_bytes: number;
    provider?: "supabase" | "r2";
  }>;
}) {
  const { supabase, user, error } = await requireUser();
  if (error) return { error };
  const body = (input.body ?? "").trim();
  if (body.length > MAX_BODY_LEN) {
    return { error: `Mesaj çok uzun (en fazla ${MAX_BODY_LEN} karakter).` };
  }
  if (!body && (!input.attachments || input.attachments.length === 0)) {
    return { error: "Boş mesaj gönderilemez" };
  }

  const { data: msg, error: mErr } = await supabase
    .from("messages")
    .insert({
      conversation_id: input.conversationId,
      author_id: user.id,
      body: body || null,
      reply_to: input.replyTo ?? null,
    })
    .select("id")
    .single();
  if (mErr || !msg) return { error: mErr?.message ?? "Mesaj gönderilemedi" };

  if (input.attachments && input.attachments.length > 0) {
    const attRows = input.attachments.map((a) => ({
      message_id: msg.id,
      storage_path: a.storage_path,
      file_name: a.file_name,
      mime_type: a.mime_type,
      size_bytes: a.size_bytes,
      provider: a.provider ?? "supabase",
    }));
    const { error: aErr } = await supabase
      .from("message_attachments")
      .insert(attRows);
    if (aErr) {
      // Best-effort: leave the bare message in place; surface the error.
      return { id: msg.id as string, error: `Mesaj gitti, dosya hatası: ${aErr.message}` };
    }
  }

  // Bump my own last_read_at — sender shouldn't see their own message as unread.
  await supabase
    .from("conversation_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", input.conversationId)
    .eq("user_id", user.id);

  return { id: msg.id as string };
}

export async function editMessage(messageId: string, body: string) {
  const { supabase, error } = await requireUser();
  if (error) return { error };
  const trimmed = body.trim();
  if (!trimmed) return { error: "Boş mesaj kaydedilemez" };
  const { error: e } = await supabase
    .from("messages")
    .update({ body: trimmed, edited_at: new Date().toISOString() })
    .eq("id", messageId);
  if (e) return { error: e.message };
  return { success: true };
}

export async function deleteMessage(messageId: string) {
  const { supabase, error } = await requireUser();
  if (error) return { error };
  // RPC route — SECURITY DEFINER on the server side, so the silent
  // RLS-read-after-update trap that was producing "yetki yok"
  // toasts on legitimate deletes is bypassed entirely. The function
  // raises specific errcodes that we map to friendly Turkish here.
  const { data, error: e } = await supabase.rpc("soft_delete_message", {
    p_message_id: messageId,
  });
  if (e) {
    const msg = e.message || "";
    if (msg.includes("not_your_message")) {
      return { error: "Sadece kendi mesajını silebilirsin" };
    }
    if (msg.includes("message_not_found")) {
      return { error: "Mesaj bulunamadı (zaten silinmiş olabilir)" };
    }
    if (msg.includes("auth_required")) {
      return { error: "Giriş gerekli" };
    }
    return { error: msg };
  }
  // Defensive: RPC returned but somehow with no rows (shouldn't happen
  // — RPC raises on every failure path).
  if (!data || (Array.isArray(data) && data.length === 0)) {
    return { error: "Beklenmeyen hata: mesaj silinemedi" };
  }
  return { success: true };
}

export async function markConversationRead(conversationId: string) {
  const { supabase, user, error } = await requireUser();
  if (error) return { error };
  const { error: e } = await supabase
    .from("conversation_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id);
  if (e) return { error: e.message };
  return { success: true };
}

// ── Outlook features: archive / pin / tags (per-user) ──────────────

export async function setConversationArchived(
  conversationId: string,
  archived: boolean,
) {
  const { supabase, user, error } = await requireUser();
  if (error) return { error };
  const { error: e } = await supabase
    .from("conversation_participants")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id);
  if (e) return { error: e.message };
  revalidatePath("/messages");
  return { success: true };
}

export async function setConversationPinned(
  conversationId: string,
  pinned: boolean,
) {
  const { supabase, user, error } = await requireUser();
  if (error) return { error };
  const { error: e } = await supabase
    .from("conversation_participants")
    .update({ pinned_at: pinned ? new Date().toISOString() : null })
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id);
  if (e) return { error: e.message };
  revalidatePath("/messages");
  return { success: true };
}

export async function setConversationWallpaper(
  conversationId: string,
  wallpaper: string | null,
) {
  const { supabase, user, error } = await requireUser();
  if (error) return { error };
  if (
    wallpaper &&
    !/^#[0-9a-fA-F]{6}$/.test(wallpaper) &&
    !/^pattern:[a-z]+#[0-9a-fA-F]{6}$/.test(wallpaper)
  ) {
    return { error: "Geçersiz wallpaper" };
  }
  const { error: e } = await supabase
    .from("conversation_participants")
    .update({ wallpaper: wallpaper || null })
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id);
  if (e) return { error: e.message };
  revalidatePath("/messages");
  return { success: true };
}

export async function setConversationTags(
  conversationId: string,
  tags: string[],
) {
  const { supabase, user, error } = await requireUser();
  if (error) return { error };
  // Sanitize and dedupe — keep only known/sane tag keys.
  const clean = Array.from(
    new Set(
      tags
        .map((t) => t.trim().toLocaleLowerCase("tr"))
        .filter((t) => t && /^[a-z0-9_-]{1,20}$/.test(t)),
    ),
  );
  const { error: e } = await supabase
    .from("conversation_participants")
    .update({ tags: clean })
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id);
  if (e) return { error: e.message };
  revalidatePath("/messages");
  return { success: true };
}
