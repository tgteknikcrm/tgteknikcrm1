"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Paperclip,
  Send,
  Smile,
  X,
  FileText,
  Image as ImageIcon,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { editMessage, sendMessage } from "./actions";
import type { MessageWithRelations, Profile } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

interface Props {
  conversationId: string;
  currentUserId: string;
  currentUserProfile: Pick<Profile, "id" | "full_name" | "phone"> | null;
  replyTo: MessageWithRelations | null;
  onClearReply: () => void;
  editing: MessageWithRelations | null;
  onClearEditing: () => void;
  accent: string;
  onOptimisticAdd: (m: MessageWithRelations) => void;
  onOptimisticClear: (tempId: string) => void;
  onOptimisticFail: (tempId: string) => void;
}

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

interface PendingAttachment {
  file: File;
  storagePath: string;
  uploading: boolean;
  error?: string;
  preview?: string;
}

/* ──────────────────────────────────────────────────────────────────
   Emoji catalog — 350+ emoji grouped into 8 categories.
   Inline (no dependency) — keeps the bundle light.
   ────────────────────────────────────────────────────────────────── */

const EMOJI_GROUPS: Array<{ key: string; label: string; emojis: string[] }> = [
  {
    key: "smileys",
    label: "Yüzler",
    emojis: [
      "😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","😉","😊","😇","🥰","😍","🤩","😘","😗","😙","😚",
      "😋","😛","😜","🤪","😝","🤑","🤗","🤭","🫢","🤫","🤔","🫡","🤐","🤨","😐","😑","😶","😶‍🌫️","😏","😒",
      "🙄","😬","😮‍💨","🤥","😌","😔","😪","🤤","😴","😷","🤒","🤕","🤢","🤮","🤧","🥵","🥶","🥴","😵","🤯",
      "🤠","🥳","🥸","😎","🤓","🧐","😕","🫤","😟","🙁","☹️","😮","😯","😲","😳","🥺","🥹","😦","😧","😨",
      "😰","😥","😢","😭","😱","😖","😣","😞","😓","😩","😫","🥱","😤","😡","😠","🤬","😈","👿","💀","☠️",
    ],
  },
  {
    key: "people",
    label: "Eller",
    emojis: [
      "👋","🤚","🖐️","✋","🖖","🫱","🫲","🫳","🫴","👌","🤌","🤏","✌️","🤞","🫰","🤟","🤘","🤙","👈","👉",
      "👆","👇","☝️","👍","👎","✊","👊","🤛","🤜","👏","🙌","👐","🤲","🤝","🙏","✍️","💪","🦾","🦵","🦿",
      "🦶","👂","🦻","👃","👀","👁️","🧠","🫀","🫁","🦷","🦴",
    ],
  },
  {
    key: "love",
    label: "Kalp",
    emojis: [
      "❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","💘","💝","💟","♥️",
    ],
  },
  {
    key: "animals",
    label: "Hayvan & Doğa",
    emojis: [
      "🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐻‍❄️","🐨","🐯","🦁","🐮","🐷","🐽","🐸","🐵","🙈","🙉","🙊",
      "🐒","🐔","🐧","🐦","🐤","🦆","🦅","🦉","🦇","🐺","🐗","🐴","🦄","🐝","🪱","🐛","🦋","🐌","🐞","🐜",
      "🪰","🪲","🦗","🦂","🕷️","🌵","🎄","🌲","🌳","🌴","🌱","🌿","☘️","🍀","🌾","🌷","🌹","🥀","🌺","🌸",
      "🌼","🌻","🌞","🌝","🌚","🌑","🌒","🌓","🌔","🌕","🌖","🌗","🌘","🌙","⭐","🌟","✨","⚡","☄️","💫",
      "🔥","💥","☀️","🌤️","⛅","🌥️","🌦️","🌧️","⛈️","🌩️","🌨️","❄️","☃️","⛄","🌬️","💨","💧","💦","🌊","🌈",
    ],
  },
  {
    key: "food",
    label: "Yiyecek",
    emojis: [
      "🍏","🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🍈","🍒","🍑","🥭","🍍","🥥","🥝","🍅","🍆","🥑",
      "🥦","🥬","🥒","🌶️","🫑","🌽","🥕","🫒","🧄","🧅","🥔","🍠","🥐","🥯","🍞","🥖","🥨","🧀","🥚","🍳",
      "🧈","🥞","🧇","🥓","🥩","🍗","🍖","🌭","🍔","🍟","🍕","🥪","🥙","🧆","🌮","🌯","🥗","🥘","🫕","🍲",
      "🍜","🍝","🍣","🍱","🥟","🍤","🍙","🍚","🍘","🍥","🥮","🍢","🍡","🍧","🍨","🍦","🥧","🧁","🍰","🎂",
      "🍮","🍭","🍬","🍫","🍿","🍩","🍪","☕","🍵","🥛","🍼","🧃","🥤","🧋","🧉","🍶","🍾","🍷","🍸","🍹",
      "🍺","🍻","🥂","🥃",
    ],
  },
  {
    key: "activity",
    label: "Aktivite",
    emojis: [
      "⚽","🏀","🏈","⚾","🥎","🎾","🏐","🏉","🥏","🎱","🪀","🏓","🏸","🏒","🏑","🥍","🏏","🪃","🥅","⛳",
      "🪁","🏹","🎣","🤿","🥊","🥋","🎽","🛹","🛼","🛷","⛸️","🥌","🎿","⛷️","🏂","🪂","🏋️","🤸","🤺","⛹️",
      "🤾","🏌️","🏇","🧘","🏄","🏊","🤽","🚣","🧗","🚵","🚴","🏆","🥇","🥈","🥉","🏅","🎖️","🏵️","🎗️","🎫",
      "🎟️","🎪","🎭","🎨","🎬","🎤","🎧","🎼","🎹","🥁","🪘","🎷","🎺","🎸","🪕","🎻","🪗","🎲","♟️","🎯",
    ],
  },
  {
    key: "objects",
    label: "Nesne",
    emojis: [
      "⌚","📱","📲","💻","⌨️","🖥️","🖨️","🖱️","🖲️","🕹️","🗜️","💽","💾","💿","📀","📼","📷","📸","📹","🎥",
      "📽️","🎞️","📞","☎️","📟","📠","📺","📻","🎙️","🎚️","🎛️","🧭","⏱️","⏲️","⏰","🕰️","⌛","⏳","📡","🔋",
      "🔌","💡","🔦","🕯️","🪔","🧯","🛢️","💸","💵","💴","💶","💷","🪙","💰","💳","💎","⚖️","🪜","🧰","🪛",
      "🔧","🔨","⚒️","🛠️","⛏️","🪚","🔩","⚙️","🪤","🧱","⛓️","🧲","🔫","💣","🧨","🪓","🔪","🗡️","⚔️","🛡️",
      "🚬","⚰️","🪦","⚱️","🏺","🔮","📿","🧿","💈","⚗️","🔭","🔬","🕳️","🩹","🩺","💊","💉","🩸","🧬","🦠",
      "🧫","🧪","🌡️","🧹","🪠","🧺","🧻","🚽","🚰","🚿","🛁","🛀","🧼","🪥","🪒","🧽","🪣","🧴","🛎️","🔑",
      "🗝️","🚪","🪑","🛋️","🛏️","🛌","🧸","🪆","🖼️","🪞","🪟","🛍️","🛒","🎁","🎈","🎏","🎀","🪄","🪅","🎊",
      "🎉","🪩","🎎","🏮","🎐","🧧","✉️","📩","📨","📧","💌","📥","📤","📦","🏷️","🪧","📪","📫","📬","📭","📮",
    ],
  },
  {
    key: "symbols",
    label: "Sembol",
    emojis: [
      "✅","❌","❎","⭕","🆗","🆕","🆙","🆒","🆓","🆖","🆘","🅰️","🅱️","🆎","🅾️","🚫","⚠️","🚸","☢️","☣️",
      "⛔","📛","🚷","🚯","🚳","🚱","🔞","📵","🔇","🔈","🔉","🔊","🔔","🔕","📣","📢","💬","💭","🗯️","♻️",
      "🌐","♾️","#️⃣","*️⃣","0️⃣","1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟","💯","💢","💥","💫","💦",
      "💨","🕳️","💣","💤","♠️","♥️","♦️","♣️","🃏","🀄","🎴","✔️","☑️","🔘","🔴","🟠","🟡","🟢","🔵","🟣",
      "⚫","⚪","🟤","🔺","🔻","🔸","🔹","🔶","🔷","🔳","🔲","◼️","◻️","◾","◽","▪️","▫️","🟥","🟧","🟨",
      "🟩","🟦","🟪","🟫","➕","➖","➗","✖️","🟰","♾️",
    ],
  },
];

const ALL_EMOJIS = EMOJI_GROUPS.flatMap((g) => g.emojis);

export function MessageComposer({
  conversationId,
  currentUserId,
  currentUserProfile,
  replyTo,
  onClearReply,
  editing,
  onClearEditing,
  accent,
  onOptimisticAdd,
  onOptimisticClear,
  onOptimisticFail,
}: Props) {
  const supabase = createClient();
  // Hold the typing channel for the lifetime of this composer mount so
  // we can broadcast "is typing" pings without re-subscribing on every
  // keystroke. Throttled to one ping every ~3s.
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTypingPingRef = useRef(0);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false); // only used for the edit-save spinner
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiSearch, setEmojiSearch] = useState("");
  const [emojiCat, setEmojiCat] = useState<string>(EMOJI_GROUPS[0].key);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (editing) {
      setText(editing.body ?? "");
      textareaRef.current?.focus();
    }
  }, [editing]);

  useEffect(() => {
    setAttachments([]);
    setText("");
  }, [conversationId]);

  // Typing broadcast channel — one per conversation.
  useEffect(() => {
    const ch = supabase.channel(`typing-${conversationId}`);
    typingChannelRef.current = ch;
    ch.subscribe();
    return () => {
      supabase.removeChannel(ch);
      typingChannelRef.current = null;
    };
  }, [conversationId, supabase]);

  function announceTyping() {
    const now = Date.now();
    if (now - lastTypingPingRef.current < 3000) return;
    lastTypingPingRef.current = now;
    typingChannelRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { userId: currentUserId },
    });
  }

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(160, ta.scrollHeight) + "px";
  }, [text]);

  useEffect(() => {
    return () => {
      attachments.forEach((a) => a.preview && URL.revokeObjectURL(a.preview));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredEmojis = useMemo(() => {
    const q = emojiSearch.trim();
    if (q) {
      // Tiny fuzzy: any emoji whose group label or characters include the
      // typed substring. Latin-only labels — that's why we keep the search
      // simple. (User can still scroll/tap the categories.)
      const term = q.toLocaleLowerCase("tr");
      return ALL_EMOJIS.filter((e) =>
        e.toLocaleLowerCase("tr").includes(term),
      ).slice(0, 200);
    }
    return EMOJI_GROUPS.find((g) => g.key === emojiCat)?.emojis ?? [];
  }, [emojiSearch, emojiCat]);

  async function uploadFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    const valid: PendingAttachment[] = [];
    for (const f of arr) {
      if (f.size > MAX_FILE_SIZE) {
        toast.error(`${f.name}: 25 MB üstü dosyalar desteklenmiyor.`);
        continue;
      }
      const safe = f.name.replace(/[^\w.\-]/g, "_");
      const storagePath = `${currentUserId}/${conversationId}/${Date.now()}_${safe}`;
      const preview = f.type.startsWith("image/")
        ? URL.createObjectURL(f)
        : undefined;
      valid.push({ file: f, storagePath, uploading: true, preview });
    }
    if (valid.length === 0) return;
    setAttachments((prev) => [...prev, ...valid]);

    await Promise.all(
      valid.map(async (a) => {
        const { error } = await supabase.storage
          .from("message-attachments")
          .upload(a.storagePath, a.file, {
            cacheControl: "3600",
            upsert: false,
            contentType: a.file.type || "application/octet-stream",
          });
        setAttachments((prev) =>
          prev.map((x) =>
            x.storagePath === a.storagePath
              ? { ...x, uploading: false, error: error?.message }
              : x,
          ),
        );
        if (error) toast.error(`${a.file.name}: ${error.message}`);
      }),
    );
  }

  function removeAttachment(idx: number) {
    setAttachments((prev) => {
      const a = prev[idx];
      if (a?.preview) URL.revokeObjectURL(a.preview);
      if (a && !a.error) {
        void supabase.storage
          .from("message-attachments")
          .remove([a.storagePath]);
      }
      return prev.filter((_, i) => i !== idx);
    });
  }

  function insertEmoji(e: string) {
    setText((t) => t + e);
    textareaRef.current?.focus();
  }

  function onPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(e.clipboardData.files);
    if (files.length > 0) {
      e.preventDefault();
      void uploadFiles(files);
    }
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) void uploadFiles(files);
  }

  function onSend() {
    const body = text.trim();
    const stillUploading = attachments.some((a) => a.uploading);
    if (stillUploading) {
      toast.message("Dosyalar yükleniyor, bir saniye…");
      return;
    }
    const validAtts = attachments.filter((a) => !a.error);

    // ── Edit path: still awaited (spinner), since we just patch a row.
    if (editing) {
      if (!body) {
        toast.error("Boş mesaj kaydedilemez");
        return;
      }
      setPending(true);
      void editMessage(editing.id, body).then((r) => {
        setPending(false);
        if (r.error) {
          toast.error(r.error);
          return;
        }
        setText("");
        onClearEditing();
      });
      return;
    }

    if (!body && validAtts.length === 0) return;

    // ── Build the queue: each piece becomes its own message bubble.
    // - Text (if any) → its own message
    // - Each attachment → a separate message
    // This matches WhatsApp/Messenger behavior and keeps the feed clean.
    type Piece =
      | { kind: "text"; body: string }
      | { kind: "file"; att: PendingAttachment };
    const queue: Piece[] = [];
    if (body) queue.push({ kind: "text", body });
    for (const att of validAtts) queue.push({ kind: "file", att });

    const snapshot = { text, attachments: [...attachments] };

    // Clear UI immediately so the user can keep typing.
    setText("");
    setAttachments([]);
    onClearReply();

    // Fire each piece in order, optimistically.
    let anyError = false;
    for (let i = 0; i < queue.length; i++) {
      const piece = queue[i];
      const tempId = `temp_${Date.now()}_${i}_${Math.random()
        .toString(36)
        .slice(2)}`;
      const createdAt = new Date(Date.now() + i).toISOString();

      const optimistic: MessageWithRelations = {
        id: tempId,
        conversation_id: conversationId,
        author_id: currentUserId,
        body: piece.kind === "text" ? piece.body : null,
        reply_to: i === 0 ? replyTo?.id ?? null : null,
        created_at: createdAt,
        edited_at: null,
        deleted_at: null,
        author: currentUserProfile,
        attachments: [],
      };
      onOptimisticAdd(optimistic);

      const payload =
        piece.kind === "text"
          ? {
              conversationId,
              body: piece.body,
              replyTo: i === 0 ? replyTo?.id ?? null : null,
              attachments: undefined,
            }
          : {
              conversationId,
              body: null,
              replyTo: i === 0 ? replyTo?.id ?? null : null,
              attachments: [
                {
                  storage_path: piece.att.storagePath,
                  file_name: piece.att.file.name,
                  mime_type:
                    piece.att.file.type || "application/octet-stream",
                  size_bytes: piece.att.file.size,
                },
              ],
            };

      void sendMessage(payload).then((r) => {
        if ("error" in r && r.error) {
          if (!anyError) {
            toast.error(r.error);
            anyError = true;
            // Restore composer once on first error.
            setText(snapshot.text);
            setAttachments(snapshot.attachments);
          }
          onOptimisticFail(tempId);
          return;
        }
        setTimeout(() => onOptimisticClear(tempId), 1500);
      });
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
    if (e.key === "Escape") {
      if (editing) onClearEditing();
      if (replyTo) onClearReply();
    }
  }

  return (
    <div
      className="border-t bg-card/50 px-2 sm:px-3 py-2 shrink-0"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      {/* Reply preview */}
      {replyTo && !editing && (
        <div
          className="mb-1.5 flex items-center gap-2 rounded-md border-l-2 px-2 py-1 bg-muted/40 animate-tg-fade-in"
          style={{ borderLeftColor: accent }}
        >
          <div className="text-[11px] flex-1 min-w-0">
            <div className="font-semibold text-muted-foreground">
              Yanıtlanan: {replyTo.author?.full_name || "Mesaj"}
            </div>
            <div className="truncate opacity-80">
              {replyTo.body || "[Dosya]"}
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={onClearReply}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      )}

      {/* Edit banner */}
      {editing && (
        <div
          className="mb-1.5 flex items-center gap-2 rounded-md border-l-2 px-2 py-1 bg-amber-500/10 animate-tg-fade-in"
          style={{ borderLeftColor: "#f59e0b" }}
        >
          <div className="text-[11px] flex-1 min-w-0">
            <div className="font-semibold text-amber-700 dark:text-amber-300">
              Düzenleme modu
            </div>
            <div className="truncate opacity-80">
              Esc ile iptal, Enter ile kaydet
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={() => {
              onClearEditing();
              setText("");
            }}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      )}

      {/* Attachment chips */}
      {attachments.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1.5 animate-tg-fade-in">
          {attachments.map((a, i) => (
            <div
              key={a.storagePath}
              className={cn(
                "flex items-center gap-2 rounded-md border bg-background px-2 py-1",
                "max-w-xs",
                a.error && "border-red-500/40 bg-red-500/5",
              )}
            >
              {a.preview ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={a.preview}
                  alt={a.file.name}
                  className="size-7 rounded object-cover shrink-0"
                />
              ) : (
                <div className="size-7 rounded bg-amber-500/15 flex items-center justify-center shrink-0">
                  {a.file.type.startsWith("image/") ? (
                    <ImageIcon className="size-3.5" />
                  ) : (
                    <FileText className="size-3.5" />
                  )}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-medium truncate">
                  {a.file.name}
                </div>
                <div className="text-[10px] text-muted-foreground tabular-nums">
                  {(a.file.size / 1024).toFixed(0)} KB
                  {a.uploading && " · yükleniyor…"}
                  {a.error && " · hata"}
                </div>
              </div>
              {a.uploading ? (
                <Loader2 className="size-3 animate-spin opacity-60" />
              ) : (
                <button
                  type="button"
                  onClick={() => removeAttachment(i)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-1.5">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void uploadFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 shrink-0 transition hover:scale-110"
          onClick={() => fileInputRef.current?.click()}
          title="Dosya ekle"
        >
          <Paperclip className="size-4" />
        </Button>
        <div className="relative">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 transition hover:scale-110"
            onClick={() => setEmojiOpen((v) => !v)}
            title="Emoji"
          >
            <Smile className="size-4" />
          </Button>
          {emojiOpen && (
            <EmojiPicker
              onPick={(e) => insertEmoji(e)}
              onClose={() => setEmojiOpen(false)}
              search={emojiSearch}
              setSearch={setEmojiSearch}
              activeCat={emojiCat}
              setActiveCat={setEmojiCat}
              filtered={filteredEmojis}
            />
          )}
        </div>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (e.target.value.trim()) announceTyping();
          }}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          placeholder={editing ? "Mesajı düzenle…" : "Mesaj yaz…"}
          rows={1}
          className={cn(
            "flex-1 resize-none rounded-2xl border px-3 py-2 text-sm",
            "bg-background min-h-9 max-h-40 leading-snug",
            "focus:outline-none focus:ring-2 focus:ring-ring",
            "transition-shadow",
          )}
        />
        <Button
          type="button"
          onClick={onSend}
          disabled={
            pending ||
            (!text.trim() &&
              attachments.filter((a) => !a.error).length === 0 &&
              !editing)
          }
          className="size-9 shrink-0 rounded-full p-0 transition hover:scale-110 active:scale-95"
          style={{ backgroundColor: accent, color: "white" }}
          title={editing ? "Kaydet" : "Gönder"}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Emoji picker — categorized + searchable, no external dependency.
   ────────────────────────────────────────────────────────────────── */

function EmojiPicker({
  onPick,
  onClose,
  search,
  setSearch,
  activeCat,
  setActiveCat,
  filtered,
}: {
  onPick: (e: string) => void;
  onClose: () => void;
  search: string;
  setSearch: (s: string) => void;
  activeCat: string;
  setActiveCat: (k: string) => void;
  filtered: string[];
}) {
  return (
    <div
      className={cn(
        "absolute bottom-full left-0 mb-2 z-30 w-80 rounded-xl border bg-popover shadow-2xl",
        "flex flex-col overflow-hidden animate-tg-fade-in",
      )}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Search */}
      <div className="p-2 border-b">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Emoji ara…"
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      {/* Category tabs */}
      {!search && (
        <div className="flex items-center gap-0.5 px-1.5 py-1 border-b overflow-x-auto">
          {EMOJI_GROUPS.map((g) => (
            <button
              key={g.key}
              type="button"
              onClick={() => setActiveCat(g.key)}
              className={cn(
                "shrink-0 px-2 py-1 rounded text-[10px] font-medium transition",
                activeCat === g.key
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted",
              )}
              title={g.label}
            >
              {g.emojis[0]}
            </button>
          ))}
        </div>
      )}

      {/* Emoji grid */}
      <div className="grid grid-cols-8 gap-0.5 p-1.5 max-h-56 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="col-span-8 p-4 text-center text-xs text-muted-foreground">
            Eşleşen emoji yok.
          </div>
        ) : (
          filtered.map((e, i) => (
            <button
              key={`${e}-${i}`}
              type="button"
              onClick={() => onPick(e)}
              className="size-8 rounded hover:bg-muted text-lg leading-none transition active:scale-90"
            >
              {e}
            </button>
          ))
        )}
      </div>

      <div className="px-2 py-1 border-t text-[10px] text-muted-foreground flex items-center justify-between">
        <span>{filtered.length} emoji</span>
        <button
          type="button"
          onClick={onClose}
          className="hover:text-foreground"
        >
          Kapat
        </button>
      </div>
    </div>
  );
}
