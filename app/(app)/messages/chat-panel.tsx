"use client";

import React, { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import {
  ArrowLeft,
  MoreVertical,
  Reply,
  Trash2,
  Pencil,
  Download,
  FileText,
  Image as ImageIcon,
  X,
  Loader2,
  Users,
  Settings,
  Check,
  CheckCheck,
  Pin,
  PinOff,
  Archive,
  ArchiveRestore,
  Tag,
} from "lucide-react";
import {
  CONVERSATION_COLOR_PRESETS,
  readableTextOn,
  type Conversation,
  type ConversationParticipant,
  type Message,
  type MessageAttachment,
  type MessageWithRelations,
  type Profile,
} from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import { formatPhoneForDisplay } from "@/lib/phone";
import { cn } from "@/lib/utils";
import {
  deleteMessage,
  editMessage,
  leaveConversation,
  markConversationRead,
  removeParticipant,
  renameConversation,
  setConversationColor,
  addParticipant,
  setConversationArchived,
  setConversationPinned,
  setConversationTags,
} from "./actions";
import {
  CONVERSATION_TAG_PRESETS,
  CHAT_WALLPAPER_PATTERNS,
  CHAT_WALLPAPER_COLORS,
  formatWallpaper,
  parseWallpaper,
  presenceLabel,
  tagMeta,
  type ChatWallpaperPattern,
} from "@/lib/supabase/types";
import { MessageComposer } from "./message-composer";
import { setConversationWallpaper } from "./actions";

interface Props {
  conversation: Conversation;
  participants: ConversationParticipant[];
  myParticipant: ConversationParticipant | null;
  initialMessages: MessageWithRelations[];
  currentUserId: string;
  people: Array<
    Pick<Profile, "id" | "full_name" | "phone" | "last_seen_at">
  >;
}

function initials(s: string | null | undefined): string {
  if (!s) return "?";
  return s
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatTimeShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(d, today)) return "Bugün";
  if (sameDay(d, yesterday)) return "Dün";
  return d.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    year: d.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}

export function ChatPanel({
  conversation,
  participants: initialParticipants,
  myParticipant,
  initialMessages,
  currentUserId,
  people,
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const profileById = useMemo(
    () => new Map(people.map((p) => [p.id, p])),
    [people],
  );

  const [messages, setMessages] = useState<MessageWithRelations[]>(initialMessages);
  const [participants, setParticipants] = useState(initialParticipants);
  // Optimistic messages — pushed instantly when the user taps Send so the
  // bubble appears with no perceived delay. They live alongside the
  // server-confirmed `messages` array, keyed by a `temp_*` id. Realtime
  // INSERT replaces them by content match (or we drop them on success).
  const [optimistic, setOptimistic] = useState<MessageWithRelations[]>([]);
  const [replyTo, setReplyTo] = useState<MessageWithRelations | null>(null);
  const [editing, setEditing] = useState<MessageWithRelations | null>(null);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [pendingHeaderAction, startHeaderAction] = useTransition();
  // userId → expiresAt timestamp for "is currently typing"
  const [typingMap, setTypingMap] = useState<Map<string, number>>(new Map());

  // Reset state whenever the active conversation changes (route change → key
  // changes via parent re-render). The arrays come from props.
  useEffect(() => {
    setMessages(initialMessages);
    setParticipants(initialParticipants);
    setOptimistic([]);
    setReplyTo(null);
    setEditing(null);
    setTagPickerOpen(false);
  }, [conversation.id, initialMessages, initialParticipants]);

  // ── Optimistic helpers (passed to the composer) ─────────────────
  function pushOptimistic(msg: MessageWithRelations) {
    setOptimistic((prev) => [...prev, msg]);
  }
  function clearOptimistic(tempId: string) {
    setOptimistic((prev) => prev.filter((m) => m.id !== tempId));
  }
  function failOptimistic(tempId: string) {
    setOptimistic((prev) =>
      prev.map((m) =>
        m.id === tempId
          ? { ...m, body: (m.body ?? "") + " ⚠️", deleted_at: null }
          : m,
      ),
    );
  }

  const isPinned = !!myParticipant?.pinned_at;
  const isArchived = !!myParticipant?.archived_at;
  const myTags = myParticipant?.tags ?? [];
  const myWallpaper = parseWallpaper(myParticipant?.wallpaper);
  const wallpaperStyle = wallpaperCss(myWallpaper.pattern, myWallpaper.color);

  function doPin() {
    startHeaderAction(async () => {
      const r = await setConversationPinned(conversation.id, !isPinned);
      if (r.error) toast.error(r.error);
      else toast.success(isPinned ? "Sabitleme kaldırıldı" : "Sabitlendi");
      router.refresh();
    });
  }
  function doArchive() {
    startHeaderAction(async () => {
      const r = await setConversationArchived(conversation.id, !isArchived);
      if (r.error) toast.error(r.error);
      else toast.success(isArchived ? "Arşivden çıkarıldı" : "Arşivlendi");
      router.refresh();
    });
  }
  function toggleTag(key: string) {
    const next = myTags.includes(key)
      ? myTags.filter((t) => t !== key)
      : [...myTags, key];
    startHeaderAction(async () => {
      const r = await setConversationTags(conversation.id, next);
      if (r.error) toast.error(r.error);
      router.refresh();
    });
  }

  const accent = conversation.color || "#3b82f6";
  const accentText = readableTextOn(accent);

  const otherParticipants = participants.filter((p) => p.user_id !== currentUserId);
  const directOther =
    conversation.kind === "direct"
      ? profileById.get(otherParticipants[0]?.user_id ?? "") ?? null
      : null;

  const headerTitle =
    conversation.kind === "group"
      ? conversation.title || "Grup"
      : directOther?.full_name ||
        formatPhoneForDisplay(directOther?.phone ?? null) ||
        "—";

  const [otherOnline, otherSeenLabel] = presenceLabel(
    directOther?.last_seen_at ?? null,
  );

  const headerSubtitle =
    conversation.kind === "group"
      ? `${participants.length} üye`
      : otherSeenLabel || formatPhoneForDisplay(directOther?.phone ?? null);

  // ── Mark-as-read: when this conversation is open, kiss the unread away.
  useEffect(() => {
    void markConversationRead(conversation.id);
  }, [conversation.id, messages.length]);

  // Realtime listening for messages + participants is handled centrally by
  // MessagesClient — it owns the per-conversation cache and keeps every
  // open thread up-to-date. ChatPanel just renders whatever props arrive.

  // ── Typing indicator: separate broadcast channel.
  // Composer sends `{ type: "broadcast", event: "typing", payload: { userId } }`
  // every few seconds while the user is typing. We hold each peer's
  // userId in `typingMap` with a 5-second TTL so the badge fades out
  // automatically when they stop.
  useEffect(() => {
    const ch = supabase
      .channel(`typing-${conversation.id}`)
      .on("broadcast", { event: "typing" }, (payload) => {
        const uid = (payload.payload as { userId?: string } | undefined)
          ?.userId;
        if (!uid || uid === currentUserId) return;
        setTypingMap((prev) => {
          const next = new Map(prev);
          next.set(uid, Date.now() + 5000);
          return next;
        });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [conversation.id, supabase, currentUserId]);

  // Periodically purge stale typing entries (TTL passed).
  useEffect(() => {
    const t = setInterval(() => {
      setTypingMap((prev) => {
        const now = Date.now();
        let changed = false;
        const next = new Map<string, number>();
        for (const [k, v] of prev) {
          if (v > now) next.set(k, v);
          else changed = true;
        }
        return changed ? next : prev;
      });
    }, 1500);
    return () => clearInterval(t);
  }, []);

  const typingUsers = Array.from(typingMap.entries())
    .filter(([uid, exp]) => uid !== currentUserId && exp > Date.now())
    .map(([uid]) => profileById.get(uid))
    .filter(
      (p): p is Pick<Profile, "id" | "full_name" | "phone" | "last_seen_at"> =>
        !!p,
    );

  // ── Auto-scroll to bottom on new messages.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  // Group messages by day for nicer separators. We merge server messages
  // with the optimistic queue, sorted by created_at. Optimistic rows have
  // an id starting with "temp_" and are visually marked as "sending".
  const grouped = useMemo(() => {
    const merged = [...messages, ...optimistic].sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    const out: { day: string; items: MessageWithRelations[] }[] = [];
    for (const m of merged) {
      const day = formatDayLabel(m.created_at);
      const last = out[out.length - 1];
      if (last && last.day === day) last.items.push(m);
      else out.push({ day, items: [m] });
    }
    return out;
  }, [messages, optimistic]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header
        className="flex items-center gap-3 px-3 py-2.5 border-b shrink-0 bg-card/50"
      >
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="size-8 md:hidden"
          aria-label="Geri"
        >
          <a href="/messages">
            <ArrowLeft className="size-4" />
          </a>
        </Button>
        <div className="relative shrink-0">
          <Avatar
            className="size-9"
            style={{ backgroundColor: accent }}
          >
            <AvatarFallback
              style={{ backgroundColor: accent, color: accentText }}
              className="text-xs font-bold"
            >
              {conversation.kind === "group" ? (
                <Users className="size-4" />
              ) : (
                initials(headerTitle)
              )}
            </AvatarFallback>
          </Avatar>
          {conversation.kind === "direct" && otherOnline && (
            <span
              className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-500 border-2 border-card"
              title="Online"
              aria-label="Online"
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm truncate leading-tight flex items-center gap-1.5">
            {isPinned && (
              <Pin className="size-3 shrink-0 text-amber-500 fill-amber-500" />
            )}
            {headerTitle}
            {isArchived && (
              <Badge
                variant="outline"
                className="h-4 text-[9px] bg-zinc-500/10"
              >
                Arşivde
              </Badge>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1.5">
            <span>{headerSubtitle}</span>
            {myTags.length > 0 && (
              <span className="flex gap-1 flex-wrap">
                {myTags.map((t) => {
                  const meta = tagMeta(t);
                  return (
                    <span
                      key={t}
                      className={cn(
                        "inline-flex items-center gap-1 px-1.5 h-4 rounded-full text-[9px] font-semibold",
                        meta.bg,
                        meta.text,
                      )}
                    >
                      <span
                        className={cn("size-1.5 rounded-full", meta.dot)}
                      />
                      {meta.name}
                    </span>
                  );
                })}
              </span>
            )}
          </div>
        </div>

        {/* Outlook-style action toolbar (pin / archive / tag / settings) */}
        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={doPin}
            disabled={pendingHeaderAction}
            className="size-9 transition hover:scale-105"
            title={isPinned ? "Sabitlemeyi kaldır" : "Sabitle"}
          >
            {pendingHeaderAction ? (
              <Loader2 className="size-4 animate-spin" />
            ) : isPinned ? (
              <PinOff className="size-4" />
            ) : (
              <Pin className="size-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={doArchive}
            disabled={pendingHeaderAction}
            className="size-9 transition hover:scale-105"
            title={isArchived ? "Arşivden çıkar" : "Arşivle"}
          >
            {isArchived ? (
              <ArchiveRestore className="size-4" />
            ) : (
              <Archive className="size-4" />
            )}
          </Button>
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTagPickerOpen((v) => !v)}
              disabled={pendingHeaderAction}
              className="size-9 transition hover:scale-105"
              title="Etiketle"
            >
              <Tag className="size-4" />
            </Button>
            {tagPickerOpen && (
              <div
                className="absolute z-30 right-0 top-full mt-1 w-48 rounded-lg border bg-popover shadow-lg p-1.5 animate-tg-fade-in"
                onMouseLeave={() => setTagPickerOpen(false)}
              >
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1.5 py-1">
                  Etiketler
                </div>
                {CONVERSATION_TAG_PRESETS.filter(
                  (t) => t.key !== "arsiv",
                ).map((t) => {
                  const checked = myTags.includes(t.key);
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => toggleTag(t.key)}
                      className="w-full flex items-center gap-2 px-1.5 py-1.5 rounded text-xs transition hover:bg-muted"
                    >
                      <span
                        className={cn("size-2 rounded-full", t.dot)}
                      />
                      <span className="flex-1 text-left">{t.name}</span>
                      {checked && (
                        <Check className="size-3.5 text-primary" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <ConversationSettings
            conversation={conversation}
            participants={participants}
            people={people}
            currentUserId={currentUserId}
            accent={accent}
          />
        </div>
      </header>

      {/* Messages feed — user-chosen wallpaper applied as background */}
      <div
        ref={scrollRef}
        className={cn(
          "flex-1 overflow-y-auto p-3 sm:p-4 space-y-1",
          // Fallback when no wallpaper is set
          !wallpaperStyle && "bg-muted/20",
        )}
        style={wallpaperStyle ?? undefined}
      >
        {grouped.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-12">
            İlk mesajı sen yaz. 👋
          </div>
        )}
        {grouped.map((g) => (
          <div key={g.day}>
            <div className="text-center my-3">
              <span className="text-[10px] font-bold uppercase tracking-wider bg-card border rounded-full px-2.5 py-0.5 text-muted-foreground">
                {g.day}
              </span>
            </div>
            <div className="space-y-1">
              {g.items.map((m, idx) => {
                const prev = g.items[idx - 1];
                const consecutive =
                  prev &&
                  prev.author_id === m.author_id &&
                  new Date(m.created_at).getTime() -
                    new Date(prev.created_at).getTime() <
                    60 * 1000;
                const fromMe = m.author_id === currentUserId;
                // Read receipt: if any other participant's last_read_at is
                // after this message's created_at, treat it as "seen".
                let receipt: "sent" | "delivered" | "seen" = "sent";
                if (fromMe) {
                  const others = participants.filter(
                    (p) => p.user_id !== currentUserId,
                  );
                  const seenByAny = others.some(
                    (p) =>
                      p.last_read_at &&
                      new Date(p.last_read_at) >= new Date(m.created_at),
                  );
                  receipt = seenByAny ? "seen" : "delivered";
                }
                return (
                  <MessageBubble
                    key={m.id}
                    message={m}
                    fromMe={fromMe}
                    consecutive={!!consecutive}
                    receipt={receipt}
                    showAuthorName={
                      conversation.kind === "group" &&
                      !consecutive &&
                      m.author_id !== currentUserId
                    }
                    accent={accent}
                    accentText={accentText}
                    onReply={() => setReplyTo(m)}
                    onEdit={() => setEditing(m)}
                    repliedToMessage={
                      m.reply_to
                        ? messages.find((x) => x.id === m.reply_to) ?? null
                        : null
                    }
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Typing indicator — sits between feed and composer */}
      {typingUsers.length > 0 && (
        <div className="px-4 py-1.5 text-xs text-muted-foreground border-t bg-card/30 flex items-center gap-2 animate-tg-fade-in">
          <span className="flex items-center gap-0.5">
            <span
              className="size-1.5 rounded-full bg-primary animate-bounce"
              style={{ animationDelay: "0ms" }}
            />
            <span
              className="size-1.5 rounded-full bg-primary animate-bounce"
              style={{ animationDelay: "150ms" }}
            />
            <span
              className="size-1.5 rounded-full bg-primary animate-bounce"
              style={{ animationDelay: "300ms" }}
            />
          </span>
          <span>
            <strong>
              {typingUsers
                .map((p) => p.full_name?.split(" ")[0] || "Birisi")
                .join(", ")}
            </strong>{" "}
            yazıyor…
          </span>
        </div>
      )}

      {/* Composer */}
      <MessageComposer
        conversationId={conversation.id}
        currentUserId={currentUserId}
        currentUserProfile={
          profileById.get(currentUserId) ?? null
        }
        replyTo={replyTo}
        onClearReply={() => setReplyTo(null)}
        editing={editing}
        onClearEditing={() => setEditing(null)}
        accent={accent}
        onOptimisticAdd={pushOptimistic}
        onOptimisticClear={clearOptimistic}
        onOptimisticFail={failOptimistic}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */

function MessageBubble({
  message: m,
  fromMe,
  consecutive,
  receipt,
  showAuthorName,
  accent,
  accentText,
  onReply,
  onEdit,
  repliedToMessage,
}: {
  message: MessageWithRelations;
  fromMe: boolean;
  consecutive: boolean;
  receipt: "sent" | "delivered" | "seen";
  showAuthorName: boolean;
  accent: string;
  accentText: string;
  onReply: () => void;
  onEdit: () => void;
  repliedToMessage: MessageWithRelations | null;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const supabase = useMemo(() => createClient(), []);
  const isDeleted = !!m.deleted_at;
  const authorLabel =
    m.author?.full_name || formatPhoneForDisplay(m.author?.phone ?? null) || "?";

  function onDelete() {
    if (!confirm("Bu mesaj silinsin mi?")) return;
    startTransition(async () => {
      const r = await deleteMessage(m.id);
      if (r.error) toast.error(r.error);
      setMenuOpen(false);
    });
  }

  return (
    <div
      className={cn(
        "group/msg flex gap-2 max-w-full animate-tg-fade-in",
        fromMe ? "flex-row-reverse" : "flex-row",
      )}
    >
      {!fromMe && (
        <div className="w-8 shrink-0">
          {!consecutive && (
            <Avatar className="size-7">
              <AvatarFallback className="text-[10px] font-semibold bg-muted">
                {initials(authorLabel)}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      )}
      <div
        className={cn(
          "flex flex-col max-w-[80%] sm:max-w-[70%]",
          fromMe ? "items-end" : "items-start",
        )}
      >
        {showAuthorName && (
          <span className="text-[10px] font-semibold text-muted-foreground px-2 mb-0.5">
            {authorLabel}
          </span>
        )}
        {repliedToMessage && (
          <div
            className={cn(
              "rounded-md border-l-2 pl-2 pr-2.5 py-1 text-[11px] mb-0.5 max-w-full",
              "bg-muted/60 border-muted-foreground/40",
              "truncate",
            )}
            style={{
              borderLeftColor: accent,
            }}
          >
            <div className="font-semibold text-[10px] text-muted-foreground">
              {repliedToMessage.author?.full_name ||
                formatPhoneForDisplay(repliedToMessage.author?.phone ?? null) ||
                "?"}
            </div>
            <div className="truncate opacity-80">
              {repliedToMessage.deleted_at
                ? "(silindi)"
                : repliedToMessage.body || "[Dosya]"}
            </div>
          </div>
        )}
        <div className="flex items-end gap-1.5">
          {fromMe && (
            <BubbleActionMenu
              fromMe
              isDeleted={isDeleted}
              open={menuOpen}
              onOpenChange={setMenuOpen}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
              pending={pending}
            />
          )}
          <div
            className={cn(
              "rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words shadow-sm",
              fromMe
                ? "rounded-br-sm"
                : "rounded-bl-sm bg-card border",
              isDeleted && "italic opacity-60",
            )}
            style={
              fromMe
                ? { backgroundColor: accent, color: accentText }
                : undefined
            }
          >
            {isDeleted ? (
              <span>Bu mesaj silindi.</span>
            ) : (
              <>
                {m.attachments && m.attachments.length > 0 && (
                  <div className="-mx-1 -mt-1 mb-1.5 space-y-1.5">
                    {m.attachments.map((a) => (
                      <AttachmentPreview
                        key={a.id}
                        attachment={a}
                        supabase={supabase}
                        onDark={fromMe}
                      />
                    ))}
                  </div>
                )}
                {m.body && <span>{m.body}</span>}
              </>
            )}
            <div
              className={cn(
                "text-[10px] mt-1 flex items-center gap-1 justify-end opacity-75",
                fromMe ? "" : "text-muted-foreground",
              )}
              style={fromMe ? { color: accentText } : undefined}
            >
              <span>{formatTimeShort(m.created_at)}</span>
              {m.edited_at && !isDeleted && (
                <span title="düzenlendi">·düzenlendi</span>
              )}
              {fromMe && !isDeleted && (
                <ReadReceipt receipt={receipt} accentText={accentText} />
              )}
            </div>
          </div>
          {!fromMe && (
            <BubbleActionMenu
              isDeleted={isDeleted}
              open={menuOpen}
              onOpenChange={setMenuOpen}
              onReply={onReply}
              onEdit={() => {
                /* not editable */
              }}
              onDelete={() => {
                /* not deletable */
              }}
              pending={pending}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   wallpaperCss(pattern, color) — turns a (pattern, color) pair into a
   React.CSSProperties object that can drive the chat-feed background.
   `null` means "use the default".
   ────────────────────────────────────────────────────────────────── */
function wallpaperCss(
  pattern: ChatWallpaperPattern,
  color: string,
): React.CSSProperties | null {
  if (pattern === "none" && !color) return null;
  const base: React.CSSProperties = color
    ? { backgroundColor: color }
    : { backgroundColor: "transparent" };
  if (pattern === "none") return base;
  // Use a contrast-aware accent for the pattern strokes.
  const accent = readableTextOn(color || "#ffffff");
  const accentRgba =
    accent === "white" ? "rgba(255,255,255,0.10)" : "rgba(15,23,42,0.06)";
  switch (pattern) {
    case "dots":
      return {
        ...base,
        backgroundImage: `radial-gradient(${accentRgba} 1.2px, transparent 1.5px)`,
        backgroundSize: "16px 16px",
      };
    case "grid":
      return {
        ...base,
        backgroundImage: `linear-gradient(${accentRgba} 1px, transparent 1px), linear-gradient(90deg, ${accentRgba} 1px, transparent 1px)`,
        backgroundSize: "22px 22px",
      };
    case "diagonal":
      return {
        ...base,
        backgroundImage: `repeating-linear-gradient(45deg, ${accentRgba} 0 1px, transparent 1px 14px)`,
      };
    case "hex":
      return {
        ...base,
        // Approximated hex-like rhombic pattern using SVG data URI
        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='28' height='32' viewBox='0 0 28 32'><path d='M14 2 L26 9 L26 23 L14 30 L2 23 L2 9 Z' fill='none' stroke='${encodeURIComponent(accent === "white" ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.05)")}' stroke-width='1'/></svg>")`,
      };
    case "plus":
      return {
        ...base,
        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'><path d='M12 6 L12 18 M6 12 L18 12' stroke='${encodeURIComponent(accent === "white" ? "rgba(255,255,255,0.10)" : "rgba(15,23,42,0.07)")}' stroke-width='1'/></svg>")`,
      };
    case "waves":
      return {
        ...base,
        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='12' viewBox='0 0 40 12'><path d='M0 6 Q 10 0 20 6 T 40 6' fill='none' stroke='${encodeURIComponent(accent === "white" ? "rgba(255,255,255,0.10)" : "rgba(15,23,42,0.07)")}' stroke-width='1'/></svg>")`,
      };
  }
  return base;
}

/**
 * WhatsApp-style read receipt:
 *  - "sent"  → single grey tick (saved to DB, not yet read)
 *  - "seen"  → double blue tick (at least one other participant has
 *              last_read_at >= the message's created_at)
 *
 * `delivered` is treated identically to `sent` here because we don't
 * track per-device delivery — the moment Realtime pushes the row, all
 * participants effectively have it.
 */
function ReadReceipt({
  receipt,
  accentText,
}: {
  receipt: "sent" | "delivered" | "seen";
  accentText: string;
}) {
  if (receipt === "seen") {
    return (
      <CheckCheck
        className="size-3.5"
        style={{ color: "#38bdf8" /* sky-400 — pops on dark accents */ }}
      />
    );
  }
  if (receipt === "delivered") {
    return <CheckCheck className="size-3.5" style={{ color: accentText }} />;
  }
  return <Check className="size-3.5" style={{ color: accentText }} />;
}

function BubbleActionMenu({
  fromMe,
  isDeleted,
  onReply,
  onEdit,
  onDelete,
  open,
  onOpenChange,
  pending,
}: {
  fromMe?: boolean;
  isDeleted: boolean;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pending: boolean;
}) {
  if (isDeleted) return <div className="size-7" />;
  return (
    <div className="relative opacity-0 group-hover/msg:opacity-100 transition">
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        onClick={() => onOpenChange(!open)}
        aria-label="Mesaj eylemleri"
      >
        <MoreVertical className="size-3.5" />
      </Button>
      {open && (
        <div
          className={cn(
            "absolute z-20 top-full mt-1 min-w-32 rounded-md border bg-popover shadow-lg p-1",
            fromMe ? "right-0" : "left-0",
          )}
          onMouseLeave={() => onOpenChange(false)}
        >
          <button
            type="button"
            onClick={() => {
              onReply();
              onOpenChange(false);
            }}
            className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded hover:bg-accent"
          >
            <Reply className="size-3.5" /> Yanıtla
          </button>
          {fromMe && (
            <>
              <button
                type="button"
                onClick={() => {
                  onEdit();
                  onOpenChange(false);
                }}
                className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded hover:bg-accent"
              >
                <Pencil className="size-3.5" /> Düzenle
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={pending}
                className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded hover:bg-red-500/10 text-red-600"
              >
                {pending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
                Sil
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Attachment preview: image inline, PDF/file as styled link.
   Module-level cache prevents re-fetching signed URLs (and thus
   re-downloading images) on every re-render of the chat feed. We
   also dedupe in-flight requests so React Strict-Mode's double
   useEffect or rapid scrolls don't fire two roundtrips for the same
   path.
   ────────────────────────────────────────────────────────────────── */

interface SignedUrlEntry {
  url: string;
  expiresAt: number;
}
const URL_CACHE = new Map<string, SignedUrlEntry>();
const URL_INFLIGHT = new Map<string, Promise<string | null>>();
// 7 days — safe well below the upper bound and means a user that opens
// the chat will reuse the same URL for the rest of their session, so
// the browser's HTTP cache hits on every subsequent render.
const URL_TTL_S = 7 * 24 * 60 * 60;
// Refresh client-side a bit before the URL actually expires.
const URL_REFRESH_MS = (URL_TTL_S - 6 * 60 * 60) * 1000;

async function fetchSignedUrl(
  supabase: ReturnType<typeof createClient>,
  storagePath: string,
): Promise<string | null> {
  const cached = URL_CACHE.get(storagePath);
  if (cached && cached.expiresAt > Date.now()) return cached.url;
  const inflight = URL_INFLIGHT.get(storagePath);
  if (inflight) return inflight;
  const promise = (async () => {
    const { data, error } = await supabase.storage
      .from("message-attachments")
      .createSignedUrl(storagePath, URL_TTL_S);
    if (error) {
      URL_INFLIGHT.delete(storagePath);
      return null;
    }
    const url = data?.signedUrl ?? null;
    if (url) {
      URL_CACHE.set(storagePath, {
        url,
        expiresAt: Date.now() + URL_REFRESH_MS,
      });
    }
    URL_INFLIGHT.delete(storagePath);
    return url;
  })();
  URL_INFLIGHT.set(storagePath, promise);
  return promise;
}

const RawAttachmentPreview = function AttachmentPreview({
  attachment: a,
  supabase,
  onDark,
}: {
  attachment: MessageAttachment;
  supabase: ReturnType<typeof createClient>;
  onDark: boolean;
}) {
  // Synchronously read the cache so the first paint already has the URL
  // when we've seen this attachment before. Avoids the "loader → swap"
  // flash and ensures the <img src> stays stable across renders.
  const cached = URL_CACHE.get(a.storage_path);
  const cachedFresh = !!cached && cached.expiresAt > Date.now();
  const [signedUrl, setSignedUrl] = useState<string | null>(
    cachedFresh ? cached!.url : null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cachedFresh) return; // already painted from cache
    let cancelled = false;
    void fetchSignedUrl(supabase, a.storage_path).then((url) => {
      if (cancelled) return;
      if (!url) {
        setError("URL alınamadı");
        return;
      }
      setSignedUrl(url);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.storage_path]);

  const isImage = a.mime_type.startsWith("image/");
  const sizeKb = (a.size_bytes / 1024).toFixed(0);

  if (isImage && signedUrl) {
    // Use Supabase image transform for the inline thumb (resize to 600px wide,
    // re-encode as webp). Click-through link points to the original URL so
    // users can still see the full-size file.
    const sep = signedUrl.includes("?") ? "&" : "?";
    const thumbUrl = `${signedUrl}${sep}width=600&resize=contain&quality=80`;
    return (
      <a
        href={signedUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-lg overflow-hidden max-w-xs"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumbUrl}
          alt={a.file_name}
          loading="lazy"
          decoding="async"
          className="block max-h-64 w-auto"
        />
      </a>
    );
  }

  return (
    <a
      href={signedUrl ?? undefined}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "flex items-center gap-2 rounded-md border px-2.5 py-1.5",
        "hover:bg-black/5 transition max-w-xs",
        onDark ? "bg-black/10 border-white/20" : "bg-card border-muted",
      )}
    >
      <div
        className={cn(
          "size-8 rounded-md flex items-center justify-center shrink-0",
          isImage ? "bg-blue-500/15" : "bg-amber-500/15",
        )}
      >
        {isImage ? (
          <ImageIcon className="size-4" />
        ) : (
          <FileText className="size-4" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold truncate">{a.file_name}</div>
        <div className="text-[10px] opacity-70 tabular-nums">
          {sizeKb} KB · {a.mime_type.split("/")[1] ?? a.mime_type}
        </div>
      </div>
      {signedUrl ? (
        <Download className="size-4 opacity-70 shrink-0" />
      ) : error ? (
        <X className="size-4 text-red-500" />
      ) : (
        <Loader2 className="size-4 animate-spin opacity-70" />
      )}
    </a>
  );
};

// Memoize on attachment id — same row, same render. Stops the chat feed
// from refetching every signed URL whenever any other state changes
// (typing, hover, realtime updates to other messages, etc.)
const AttachmentPreview = React.memo(
  RawAttachmentPreview,
  (prev, next) =>
    prev.attachment.id === next.attachment.id && prev.onDark === next.onDark,
);

/* ──────────────────────────────────────────────────────────────────
   Settings sheet — group rename, color, members
   ────────────────────────────────────────────────────────────────── */

function ConversationSettings({
  conversation,
  participants,
  people,
  currentUserId,
  accent,
}: {
  conversation: Conversation;
  participants: ConversationParticipant[];
  people: Array<Pick<Profile, "id" | "full_name" | "phone">>;
  currentUserId: string;
  accent: string;
}) {
  const myParticipant =
    participants.find((p) => p.user_id === currentUserId) ?? null;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const profileById = useMemo(
    () => new Map(people.map((p) => [p.id, p])),
    [people],
  );
  const me = participants.find((p) => p.user_id === currentUserId);
  const isAdmin = me?.role === "admin";
  const isGroup = conversation.kind === "group";

  const [title, setTitle] = useState(conversation.title ?? "");
  const [color, setColor] = useState(conversation.color || "#3b82f6");
  const [pickAdd, setPickAdd] = useState<Set<string>>(new Set());

  const initialWp = parseWallpaper(myParticipant?.wallpaper);
  const [wpPattern, setWpPattern] = useState<ChatWallpaperPattern>(
    initialWp.pattern,
  );
  const [wpColor, setWpColor] = useState<string>(initialWp.color || "");

  useEffect(() => {
    setTitle(conversation.title ?? "");
    setColor(conversation.color || "#3b82f6");
    setPickAdd(new Set());
    const wp = parseWallpaper(myParticipant?.wallpaper);
    setWpPattern(wp.pattern);
    setWpColor(wp.color || "");
  }, [
    conversation.id,
    conversation.title,
    conversation.color,
    myParticipant?.wallpaper,
  ]);

  function applyWallpaper(p: ChatWallpaperPattern, c: string) {
    setWpPattern(p);
    setWpColor(c);
    const value = p === "none" && !c ? null : formatWallpaper(p, c || "#0f172a");
    startTransition(async () => {
      const r = await setConversationWallpaper(conversation.id, value);
      if (r.error) toast.error(r.error);
    });
  }
  function clearWallpaper() {
    setWpPattern("none");
    setWpColor("");
    startTransition(async () => {
      const r = await setConversationWallpaper(conversation.id, null);
      if (r.error) toast.error(r.error);
      else toast.success("Arka plan sıfırlandı");
    });
  }

  const candidates = people.filter(
    (p) =>
      p.id !== currentUserId &&
      !participants.some((pp) => pp.user_id === p.id),
  );

  function applyTitle() {
    if (title.trim() === (conversation.title ?? "")) return;
    startTransition(async () => {
      const r = await renameConversation(conversation.id, title);
      if (r.error) toast.error(r.error);
      else toast.success("Başlık güncellendi");
    });
  }
  function applyColor(hex: string) {
    setColor(hex);
    startTransition(async () => {
      const r = await setConversationColor(conversation.id, hex);
      if (r.error) toast.error(r.error);
    });
  }
  function doAdd() {
    if (pickAdd.size === 0) return;
    startTransition(async () => {
      for (const uid of Array.from(pickAdd)) {
        const r = await addParticipant(conversation.id, uid);
        if (r.error) {
          toast.error(r.error);
          return;
        }
      }
      toast.success(`${pickAdd.size} kişi eklendi`);
      setPickAdd(new Set());
    });
  }
  function doRemove(uid: string) {
    if (!confirm("Bu üye gruptan çıkarılsın mı?")) return;
    startTransition(async () => {
      const r = await removeParticipant(conversation.id, uid);
      if (r.error) toast.error(r.error);
      else toast.success("Üye çıkarıldı");
    });
  }
  function doLeave() {
    if (!confirm("Bu konuşmadan ayrılınsın mı?")) return;
    startTransition(async () => {
      const r = await leaveConversation(conversation.id);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Ayrıldın");
        setOpen(false);
        router.push("/messages");
      }
    });
  }

  function togglePickAdd(id: string) {
    setPickAdd((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="size-9" aria-label="Ayarlar">
          <Settings className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Avatar
              className="size-8"
              style={{ backgroundColor: accent }}
            >
              <AvatarFallback
                style={{
                  backgroundColor: accent,
                  color: readableTextOn(accent),
                }}
                className="text-xs font-bold"
              >
                {isGroup ? <Users className="size-4" /> : initials(title || "?")}
              </AvatarFallback>
            </Avatar>
            Konuşma Ayarları
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {isGroup && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Grup Adı
              </label>
              <div className="flex gap-2">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={applyTitle}
                  disabled={!isAdmin || pending}
                  className="flex-1 h-9 px-2.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  maxLength={80}
                />
                {pending && (
                  <Loader2 className="size-4 animate-spin self-center text-muted-foreground" />
                )}
              </div>
              {!isAdmin && (
                <div className="text-[11px] text-muted-foreground">
                  Sadece grup yöneticisi adı değiştirebilir.
                </div>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Renk
            </label>
            <div className="flex flex-wrap gap-2">
              {CONVERSATION_COLOR_PRESETS.map((p) => {
                const active = color.toLowerCase() === p.hex.toLowerCase();
                return (
                  <button
                    key={p.hex}
                    type="button"
                    onClick={() => applyColor(p.hex)}
                    disabled={pending}
                    className={cn(
                      "size-8 rounded-full border-2 flex items-center justify-center transition",
                      active
                        ? "ring-2 ring-primary scale-110 border-white"
                        : "border-transparent hover:scale-110",
                    )}
                    style={{ backgroundColor: p.hex }}
                    title={p.name}
                  >
                    {active && (
                      <Check className="size-3.5 text-white drop-shadow" />
                    )}
                  </button>
                );
              })}
              <input
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : "#3b82f6"}
                onChange={(e) => applyColor(e.target.value)}
                disabled={pending}
                className="size-8 rounded-full border-2 border-transparent cursor-pointer p-0"
                title="Özel renk"
              />
            </div>
          </div>

          {/* ── Chat wallpaper (per-user) ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Sohbet Arka Planı
              </label>
              {(wpPattern !== "none" || wpColor) && (
                <button
                  type="button"
                  onClick={clearWallpaper}
                  disabled={pending}
                  className="text-[11px] text-muted-foreground hover:underline"
                >
                  Sıfırla
                </button>
              )}
            </div>
            <div className="text-[10px] text-muted-foreground">
              Bu konuşmanın arka planı sadece sana özel.
            </div>

            {/* Pattern picker */}
            <div className="grid grid-cols-7 gap-1.5">
              {CHAT_WALLPAPER_PATTERNS.map((p) => {
                const active = wpPattern === p.key;
                const previewStyle = wallpaperCss(
                  p.key,
                  wpColor || "#0f172a",
                );
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => applyWallpaper(p.key, wpColor || "#0f172a")}
                    disabled={pending}
                    className={cn(
                      "h-12 rounded-md border overflow-hidden transition relative",
                      active
                        ? "ring-2 ring-primary scale-[1.04]"
                        : "hover:scale-[1.04]",
                    )}
                    style={previewStyle ?? { backgroundColor: "#f8fafc" }}
                    title={p.name}
                  >
                    {active && (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <Check className="size-4 drop-shadow text-white" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Color picker */}
            <div className="flex flex-wrap gap-1.5">
              {CHAT_WALLPAPER_COLORS.map((c) => {
                const active =
                  wpColor.toLowerCase() === c.hex.toLowerCase();
                return (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => applyWallpaper(wpPattern, c.hex)}
                    disabled={pending}
                    className={cn(
                      "size-7 rounded-full border-2 transition flex items-center justify-center",
                      active
                        ? "ring-2 ring-primary scale-110 border-white"
                        : "border-transparent hover:scale-110",
                    )}
                    style={{ backgroundColor: c.hex }}
                    title={c.name}
                  >
                    {active && (
                      <Check
                        className="size-3 drop-shadow"
                        style={{ color: readableTextOn(c.hex) }}
                      />
                    )}
                  </button>
                );
              })}
              <input
                type="color"
                value={
                  /^#[0-9a-fA-F]{6}$/.test(wpColor) ? wpColor : "#0f172a"
                }
                onChange={(e) => applyWallpaper(wpPattern, e.target.value)}
                disabled={pending}
                className="size-7 rounded-full border-2 border-transparent cursor-pointer p-0"
                title="Özel renk"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Üyeler ({participants.length})
            </label>
            <div className="rounded-md border divide-y">
              {participants.map((p) => {
                const profile = profileById.get(p.user_id);
                const isMe = p.user_id === currentUserId;
                return (
                  <div
                    key={p.user_id}
                    className="flex items-center gap-3 px-3 py-2"
                  >
                    <Avatar className="size-8">
                      <AvatarFallback className="text-[10px] font-semibold bg-muted">
                        {initials(profile?.full_name || profile?.phone)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">
                        {profile?.full_name ||
                          formatPhoneForDisplay(profile?.phone ?? null) ||
                          "—"}
                        {isMe && (
                          <span className="text-[10px] text-muted-foreground ml-1.5">
                            (sen)
                          </span>
                        )}
                      </div>
                      {p.role === "admin" && (
                        <Badge
                          variant="outline"
                          className="h-4 text-[9px] mt-0.5"
                        >
                          Yönetici
                        </Badge>
                      )}
                    </div>
                    {isGroup && isAdmin && !isMe && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => doRemove(p.user_id)}
                        disabled={pending}
                        className="size-7 text-red-600 hover:text-red-600 hover:bg-red-500/10"
                        title="Çıkar"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {isGroup && isAdmin && candidates.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Üye Ekle
              </label>
              <div className="rounded-md border max-h-48 overflow-y-auto divide-y">
                {candidates.map((p) => {
                  const checked = pickAdd.has(p.id);
                  return (
                    <label
                      key={p.id}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 cursor-pointer transition",
                        "hover:bg-muted/60",
                        checked && "bg-primary/5",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePickAdd(p.id)}
                        className="size-4"
                      />
                      <div className="text-sm font-medium truncate flex-1">
                        {p.full_name ||
                          formatPhoneForDisplay(p.phone) ||
                          "—"}
                      </div>
                    </label>
                  );
                })}
              </div>
              <Button
                size="sm"
                onClick={doAdd}
                disabled={pending || pickAdd.size === 0}
                className="w-full"
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                Seçilenleri Ekle ({pickAdd.size})
              </Button>
            </div>
          )}

          {isGroup && (
            <div className="pt-3 border-t">
              <Button
                variant="outline"
                onClick={doLeave}
                disabled={pending}
                className="w-full text-red-600 hover:text-red-600 border-red-500/40 hover:bg-red-500/10"
              >
                Konuşmadan Ayrıl
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
