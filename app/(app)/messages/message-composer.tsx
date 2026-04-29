"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Paperclip, Send, Smile, X, FileText, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { editMessage, sendMessage } from "./actions";
import type { MessageWithRelations } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

interface Props {
  conversationId: string;
  currentUserId: string;
  replyTo: MessageWithRelations | null;
  onClearReply: () => void;
  editing: MessageWithRelations | null;
  onClearEditing: () => void;
  accent: string;
}

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

const QUICK_EMOJIS = [
  "👍",
  "❤️",
  "😂",
  "🎉",
  "🙏",
  "😮",
  "😢",
  "🔥",
  "👌",
  "✅",
  "❌",
  "⚠️",
];

interface PendingAttachment {
  file: File;
  storagePath: string;
  uploading: boolean;
  error?: string;
  // Memoized object URL for image previews
  preview?: string;
}

export function MessageComposer({
  conversationId,
  currentUserId,
  replyTo,
  onClearReply,
  editing,
  onClearEditing,
  accent,
}: Props) {
  const supabase = createClient();
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // When parent enters edit mode, prefill the composer
  useEffect(() => {
    if (editing) {
      setText(editing.body ?? "");
      textareaRef.current?.focus();
    }
  }, [editing]);

  // Reset attachments when the conversation changes
  useEffect(() => {
    setAttachments([]);
    setText("");
  }, [conversationId]);

  // Auto-grow textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(160, ta.scrollHeight) + "px";
  }, [text]);

  // Revoke object URLs on unmount / change
  useEffect(() => {
    return () => {
      attachments.forEach((a) => a.preview && URL.revokeObjectURL(a.preview));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

    // Kick off uploads in parallel
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
      // Best-effort: delete the uploaded blob if it landed
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
    setEmojiOpen(false);
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
    if (pending) return;
    const body = text.trim();
    const stillUploading = attachments.some((a) => a.uploading);
    if (stillUploading) {
      toast.message("Dosyalar yükleniyor, bir saniye…");
      return;
    }
    const validAtts = attachments.filter((a) => !a.error);

    if (editing) {
      if (!body) {
        toast.error("Boş mesaj kaydedilemez");
        return;
      }
      startTransition(async () => {
        const r = await editMessage(editing.id, body);
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

    startTransition(async () => {
      const r = await sendMessage({
        conversationId,
        body: body || null,
        replyTo: replyTo?.id ?? null,
        attachments: validAtts.map((a) => ({
          storage_path: a.storagePath,
          file_name: a.file.name,
          mime_type: a.file.type || "application/octet-stream",
          size_bytes: a.file.size,
        })),
      });
      if ("error" in r && r.error) {
        toast.error(r.error);
        return;
      }
      setText("");
      // Free preview URLs we no longer need
      attachments.forEach((a) => a.preview && URL.revokeObjectURL(a.preview));
      setAttachments([]);
      onClearReply();
    });
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
          className="mb-1.5 flex items-center gap-2 rounded-md border-l-2 px-2 py-1 bg-muted/40"
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
          className="mb-1.5 flex items-center gap-2 rounded-md border-l-2 px-2 py-1 bg-amber-500/10"
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
        <div className="mb-1.5 flex flex-wrap gap-1.5">
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
          className="size-9 shrink-0"
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
            className="size-9 shrink-0"
            onClick={() => setEmojiOpen((v) => !v)}
            title="Emoji"
          >
            <Smile className="size-4" />
          </Button>
          {emojiOpen && (
            <div className="absolute bottom-full left-0 mb-2 z-30 rounded-lg border bg-popover shadow-lg p-2 grid grid-cols-6 gap-1 w-52">
              {QUICK_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => insertEmoji(e)}
                  className="size-8 rounded hover:bg-muted text-lg leading-none"
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          placeholder={editing ? "Mesajı düzenle…" : "Mesaj yaz…"}
          rows={1}
          className={cn(
            "flex-1 resize-none rounded-2xl border px-3 py-2 text-sm",
            "bg-background min-h-9 max-h-40 leading-snug",
            "focus:outline-none focus:ring-2 focus:ring-ring",
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
          className="size-9 shrink-0 rounded-full p-0"
          style={{
            backgroundColor: accent,
            color: "white",
          }}
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
