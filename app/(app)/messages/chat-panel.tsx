"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
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
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  // Set while messages-client is loading this conversation's
  // messages from Supabase (cache miss). Drives a skeleton overlay
  // in the message feed — same UX as sidebar route navigation.
  isLoading?: boolean;
  // Patch a message in the parent's cache directly. Lets us reflect
  // delete/edit instantly without waiting on a Realtime round-trip
  // (which can drop on flaky websockets / cellular).
  onApplyMessageMutation?: (
    convId: string,
    msgId: string,
    patch: Partial<MessageWithRelations>,
  ) => void;
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
  participants,
  myParticipant,
  initialMessages: messages,
  currentUserId,
  people,
  isLoading = false,
  onApplyMessageMutation,
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const profileById = useMemo(
    () => new Map(people.map((p) => [p.id, p])),
    [people],
  );

  // `messages` and `participants` come straight from props now —
  // MessagesClient owns the cache and keeps them up to date via
  // Realtime. We only own the small UI state below.
  // Optimistic messages live in the composer's parent here, scoped
  // per-conversation.
  const [optimistic, setOptimistic] = useState<MessageWithRelations[]>([]);
  const [replyTo, setReplyTo] = useState<MessageWithRelations | null>(null);
  const [editing, setEditing] = useState<MessageWithRelations | null>(null);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [pendingHeaderAction, startHeaderAction] = useTransition();
  // userId → expiresAt timestamp for "is currently typing"
  const [typingMap, setTypingMap] = useState<Map<string, number>>(new Map());
  // Optimistic delete set. The server soft-deletes (sets deleted_at)
  // and we wait for Realtime UPDATE to flow back into the cache, but
  // websockets are flaky over LAN/cellular — without an optimistic
  // overlay the user clicks "Sil" and nothing visible happens.
  const [optimisticDeletedIds, setOptimisticDeletedIds] = useState<Set<string>>(
    new Set(),
  );

  // Bodies of optimistic messages the user canceled before they
  // reached the server. When the real message lands via Realtime
  // (matching body + author within a 10s window), we silently fire
  // soft_delete_message on the real id so the cancel sticks. Without
  // this, the canceled-but-then-sent message would reappear on the
  // user's screen seconds after they thought they killed it.
  const ghostDeletesRef = useRef<Map<string, number>>(new Map());

  // Drop the optimistic queue + per-thread UI state when the user
  // switches conversations. (Keyed off the conversation id so the
  // reset doesn't fire on every render.)
  useEffect(() => {
    setOptimistic([]);
    setReplyTo(null);
    setEditing(null);
    setTagPickerOpen(false);
    setTypingMap(new Map());
    setOptimisticDeletedIds(new Set());
    ghostDeletesRef.current = new Map();
  }, [conversation.id]);

  // Reaper: when a real message arrives that matches a body the user
  // canceled while it was still optimistic, soft-delete it server-side.
  // GCs entries older than 10 seconds to bound memory.
  useEffect(() => {
    const map = ghostDeletesRef.current;
    if (map.size === 0) return;
    const now = Date.now();
    for (const [body, ts] of map.entries()) {
      if (now - ts > 10_000) map.delete(body);
    }
    for (const m of messages) {
      if (m.author_id !== currentUserId) continue;
      if (m.deleted_at) continue;
      if (!m.body) continue;
      if (!map.has(m.body)) continue;
      const ts = map.get(m.body)!;
      // Only delete real messages created after the cancel — protects
      // against an unrelated older message with the same body.
      if (new Date(m.created_at).getTime() < ts - 5_000) continue;
      map.delete(m.body);
      const realId = m.id;
      void deleteMessage(realId).then((r) => {
        if (!r.error) {
          onApplyMessageMutation?.(conversation.id, realId, {
            deleted_at: new Date().toISOString(),
            body: null,
          });
        }
      });
    }
  }, [messages, currentUserId, conversation.id, onApplyMessageMutation]);

  // Drop optimistic-deleted ids the moment the server prop reports
  // the same id with a deleted_at — drag-fix style sync, no timing.
  useEffect(() => {
    if (optimisticDeletedIds.size === 0) return;
    setOptimisticDeletedIds((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const id of prev) {
        const serverMsg = messages.find((m) => m.id === id);
        if (!serverMsg || serverMsg.deleted_at) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [messages, optimisticDeletedIds]);

  function markOptimisticDeleted(id: string) {
    setOptimisticDeletedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }
  function unmarkOptimisticDeleted(id: string) {
    setOptimisticDeletedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  // When my own message lands from the server (realtime → cache → props),
  // pop the oldest optimistic placeholder so we don't show duplicates.
  useEffect(() => {
    setOptimistic((prev) => {
      if (prev.length === 0) return prev;
      const myConfirmed = messages.filter(
        (m) => m.author_id === currentUserId,
      );
      // Match the oldest optimistic to the newest confirmed by body —
      // good enough for our case since we send sequentially.
      const last = myConfirmed[myConfirmed.length - 1];
      if (!last) return prev;
      const idx = prev.findIndex((p) => (p.body ?? "") === (last.body ?? ""));
      if (idx === -1) return prev;
      const next = [...prev];
      next.splice(idx, 1);
      return next;
    });
  }, [messages, currentUserId]);

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

  // User clicked "Sil" on an optimistic (still-sending) message.
  // Drop it from the local queue immediately and remember its body
  // so the reaper can soft-delete the server copy if/when it lands.
  function cancelOptimistic(tempId: string, body: string | null) {
    setOptimistic((prev) => prev.filter((m) => m.id !== tempId));
    if (body) {
      ghostDeletesRef.current.set(body, Date.now());
    }
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

  // ── Scroll management (single useLayoutEffect — no jitter) ──
  //
  // Why useLayoutEffect over useEffect+rAF:
  //   useEffect runs AFTER the browser paints. So the user briefly
  //   sees the new conversation rendered with scroll at top before
  //   our scroll-to-bottom kicks in — that's the "scroll yukarı
  //   gidip alta dönüyor" jitter the user reported.
  //   useLayoutEffect runs synchronously AFTER the DOM mutation but
  //   BEFORE paint, so the scroll position is correct on the very
  //   first frame the user sees. No rAF needed.
  //
  // Three rules in one place so they stay consistent:
  //   1. Conversation switched (id changed) → INSTANT jump to bottom
  //      (no animation bleed, no leftover scroll from the previous
  //      thread). Stamp lastOptimisticLenRef so rule 2 doesn't also
  //      fire on the same render.
  //   2. New message in CURRENT thread → smooth scroll if the user is
  //      already near bottom (120px tolerance). If they scrolled up
  //      to read older messages, leave their position alone.
  //   3. New optimistic message I just sent → ALWAYS scroll (instant,
  //      so the input stays glued to the latest content even with
  //      rapid typing). The user intentionally acted; the new line
  //      must be visible.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastConvIdRef = useRef<string | null>(null);
  const atBottomRef = useRef(true);
  const lastOptimisticLenRef = useRef(0);
  const lastMsgCountRef = useRef(0);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    // Rule 1: conversation switch — INSTANT jump regardless of content.
    if (lastConvIdRef.current !== conversation.id) {
      lastConvIdRef.current = conversation.id;
      lastOptimisticLenRef.current = optimistic.length;
      lastMsgCountRef.current = messages.length;
      el.scrollTop = el.scrollHeight;
      atBottomRef.current = true;
      return;
    }

    // Same thread — observe content updates.
    const optimisticGrew = optimistic.length > lastOptimisticLenRef.current;
    lastOptimisticLenRef.current = optimistic.length;

    // Rule 3: I just sent something (instant; smooth would lag behind
    // fast typing where the next message lands before the animation
    // finishes).
    if (optimisticGrew) {
      el.scrollTop = el.scrollHeight;
      atBottomRef.current = true;
      lastMsgCountRef.current = messages.length;
      return;
    }

    // Rule 2a: cache miss → first content batch lands AFTER conversation
    // switch (we initially rendered with messages=[] then the cache fill
    // populated N items). Use INSTANT jump — smooth-scrolling N rows
    // looks like the "yukarı aşağı kendi yerine geliyor" jitter the
    // user reported.
    const wasEmpty =
      lastMsgCountRef.current === 0 && messages.length > 0;
    lastMsgCountRef.current = messages.length;
    if (wasEmpty) {
      el.scrollTop = el.scrollHeight;
      atBottomRef.current = true;
      return;
    }

    // Rule 2b: incremental message landed mid-thread. Smooth only if
    // user is already near the bottom (otherwise leave them alone so
    // they can read older messages without a snap).
    if (atBottomRef.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [conversation.id, messages.length, optimistic.length]);

  // Track whether the user is at-bottom (120px tolerance covers a
  // half-typed line of preview content and small toolbars).
  function onScrollFeed() {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    atBottomRef.current = distance < 120;
  }

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
        onScroll={onScrollFeed}
        className={cn(
          "flex-1 overflow-y-auto p-3 sm:p-4 space-y-1",
          // Fallback when no wallpaper is set
          !wallpaperStyle && "bg-muted/20",
        )}
        style={wallpaperStyle ?? undefined}
      >
        {isLoading && grouped.length === 0 && <FeedSkeleton />}
        {!isLoading && grouped.length === 0 && (
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
                const isOptimistic = m.id.startsWith("temp_");
                // Read receipt: if any other participant's last_read_at is
                // after this message's created_at, treat it as "seen".
                let receipt: "sending" | "sent" | "delivered" | "seen" = "sent";
                if (isOptimistic) {
                  receipt = "sending";
                } else if (fromMe) {
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
                    authorProfile={
                      m.author_id
                        ? profileById.get(m.author_id) ?? null
                        : null
                    }
                    optimisticDeleted={optimisticDeletedIds.has(m.id)}
                    onOptimisticDelete={markOptimisticDeleted}
                    onOptimisticDeleteRollback={unmarkOptimisticDeleted}
                    onCancelOptimistic={cancelOptimistic}
                    onCacheMutate={(patch) =>
                      onApplyMessageMutation?.(conversation.id, m.id, patch)
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
  authorProfile,
  optimisticDeleted,
  onOptimisticDelete,
  onOptimisticDeleteRollback,
  onCancelOptimistic,
  onCacheMutate,
}: {
  message: MessageWithRelations;
  fromMe: boolean;
  consecutive: boolean;
  receipt: "sending" | "sent" | "delivered" | "seen";
  showAuthorName: boolean;
  accent: string;
  accentText: string;
  onReply: () => void;
  onEdit: () => void;
  repliedToMessage: MessageWithRelations | null;
  authorProfile: Pick<Profile, "id" | "full_name" | "phone" | "last_seen_at"> | null;
  optimisticDeleted: boolean;
  onOptimisticDelete: (id: string) => void;
  onOptimisticDeleteRollback: (id: string) => void;
  onCancelOptimistic: (tempId: string, body: string | null) => void;
  onCacheMutate?: (patch: Partial<MessageWithRelations>) => void;
}) {
  const router = useRouter();
  const isOptimistic = m.id.startsWith("temp_");
  const [pending, startTransition] = useTransition();
  const isDeleted = !!m.deleted_at || optimisticDeleted;
  const authorLabel =
    m.author?.full_name || formatPhoneForDisplay(m.author?.phone ?? null) || "?";

  function onDelete() {
    // Optimistic message — server hasn't seen it yet. We can't call
    // soft_delete_message (no real id), but we CAN cancel it visually
    // and arm the reaper to soft-delete the server copy when/if it
    // arrives via Realtime. Net effect: user clicks Sil and the
    // bubble vanishes immediately, no "henüz gönderilmedi" gate.
    if (isOptimistic) {
      if (!confirm("Bu mesaj iptal edilsin mi?")) return;
      onCancelOptimistic(m.id, m.body ?? null);
      toast.success("Mesaj iptal edildi");
      return;
    }
    if (!confirm("Bu mesaj silinsin mi?")) return;
    // Optimistic mark — bubble flips to "Bu mesaj silindi" instantly,
    // even if Realtime websocket is flaky. The shell's sync effect
    // clears the override the moment the server prop catches up.
    onOptimisticDelete(m.id);
    startTransition(async () => {
      const r = await deleteMessage(m.id);
      if (r.error) {
        toast.error(r.error);
        onOptimisticDeleteRollback(m.id);
        return;
      }
      // Patch the parent's cache directly — no longer rely solely on
      // Realtime UPDATE event (which can drop on flaky LAN/cellular).
      // This is the durable fix for "mesaj silinmiyor": the cache now
      // holds deleted_at the moment the server confirms.
      onCacheMutate?.({
        deleted_at: new Date().toISOString(),
        body: null,
      });
      // Best-effort backstop: also nudge server-side cache so that
      // any non-cached pages refresh too.
      router.refresh();
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
            <AuthorHoverCard profile={authorProfile} fallbackLabel={authorLabel}>
              <Avatar className="size-7 cursor-pointer">
                <AvatarFallback className="text-[10px] font-semibold bg-muted">
                  {initials(authorLabel)}
                </AvatarFallback>
              </Avatar>
            </AuthorHoverCard>
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
          <AuthorHoverCard profile={authorProfile} fallbackLabel={authorLabel}>
            <span className="text-[10px] font-semibold text-muted-foreground px-2 mb-0.5 cursor-pointer hover:underline">
              {authorLabel}
            </span>
          </AuthorHoverCard>
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
              isOptimistic && "opacity-75",
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
   FeedSkeleton — shown while messages-client is fetching this
   conversation's history (cache miss). Same UX as the sidebar route
   navigation loading: a few placeholder bubbles to telegraph that
   content is on its way without flashing an empty white pane.
   ────────────────────────────────────────────────────────────────── */
function FeedSkeleton() {
  // Hand-tuned widths so the skeleton feels like a real conversation,
  // not a uniform stripe.
  const rows: Array<{ side: "left" | "right"; w: string }> = [
    { side: "left", w: "60%" },
    { side: "right", w: "45%" },
    { side: "left", w: "75%" },
    { side: "right", w: "55%" },
    { side: "left", w: "40%" },
    { side: "right", w: "65%" },
  ];
  return (
    <div className="space-y-3 py-2">
      {rows.map((r, i) => (
        <div
          key={i}
          className={cn("flex", r.side === "right" ? "justify-end" : "justify-start")}
        >
          <div
            className="h-9 rounded-2xl bg-muted/60 animate-pulse"
            style={{ width: r.w }}
          />
        </div>
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   AuthorHoverCard — wraps an avatar / author-name with a tooltip-like
   popover showing the author's full name, phone, and last-seen.
   Triggered on hover (Radix HoverCard, 200ms open delay).
   ────────────────────────────────────────────────────────────────── */
function AuthorHoverCard({
  profile,
  fallbackLabel,
  children,
}: {
  profile: Pick<Profile, "id" | "full_name" | "phone" | "last_seen_at"> | null;
  fallbackLabel: string;
  children: React.ReactNode;
}) {
  if (!profile) {
    // Unknown author — just render the trigger without a popover.
    return <>{children}</>;
  }
  const [, presence] = presenceLabel(profile.last_seen_at ?? null);
  const phone = formatPhoneForDisplay(profile.phone);
  const display = profile.full_name || phone || fallbackLabel;
  return (
    <HoverCard openDelay={200} closeDelay={120}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent align="start" className="w-60">
        <div className="flex items-start gap-3">
          <Avatar className="size-10 shrink-0">
            <AvatarFallback className="text-xs font-bold bg-primary/15 text-primary">
              {initials(display)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold leading-tight truncate">
              {display}
            </div>
            {phone && profile.full_name && (
              <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                {phone}
              </div>
            )}
            <div className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1.5">
              <span
                className={cn(
                  "size-1.5 rounded-full shrink-0",
                  presence === "Online"
                    ? "bg-emerald-500"
                    : "bg-muted-foreground/60",
                )}
              />
              <span>{presence}</span>
            </div>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
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
  receipt: "sending" | "sent" | "delivered" | "seen";
  accentText: string;
}) {
  if (receipt === "sending") {
    return (
      <Loader2
        className="size-3 animate-spin"
        style={{ color: accentText }}
      />
    );
  }
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
  pending,
}: {
  fromMe?: boolean;
  isDeleted: boolean;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  open?: boolean; // legacy, ignored — radix handles its own open state
  onOpenChange?: (v: boolean) => void;
  pending: boolean;
}) {
  if (isDeleted) return <div className="size-8" />;
  // Radix DropdownMenu renders the panel inside a portal attached to
  // <body>, so the parent's `overflow-y-auto` (the chat feed) can't
  // clip it and z-index conflicts disappear. It also handles
  // click-outside, Esc, focus trap, and keyboard nav for free.
  //
  // Trigger is fully opaque (was 70%) — users were missing it. The
  // hover ring + open ring still differentiate idle / active states
  // so the affordance is clear without being subtle.
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "size-8 rounded-full bg-background border shadow-sm shrink-0",
            "hover:bg-accent hover:ring-2 hover:ring-primary/30 transition",
            "data-[state=open]:bg-background data-[state=open]:ring-2 data-[state=open]:ring-primary/40",
          )}
          aria-label="Mesaj eylemleri"
          title="Mesaj eylemleri (yanıtla, düzenle, sil)"
        >
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={fromMe ? "end" : "start"}
        sideOffset={6}
        className="min-w-40"
      >
        <DropdownMenuItem onSelect={onReply} className="gap-2">
          <Reply className="size-4" /> Yanıtla
        </DropdownMenuItem>
        {fromMe && (
          <>
            <DropdownMenuItem onSelect={onEdit} className="gap-2">
              <Pencil className="size-4" /> Düzenle
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={pending}
              onSelect={(e) => {
                e.preventDefault();
                onDelete();
              }}
              className="gap-2 text-red-600 focus:text-red-600 focus:bg-red-500/10"
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Sil
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Attachment preview — deterministic, token-less URL.
   Two providers:
     - `supabase`: served via /api/attach/[id] (Vercel route)
     - `r2`:        served via the Cloudflare Worker at NEXT_PUBLIC_R2_PUBLIC_URL
   Both yield stable URLs so the browser HTTP cache (1-year immutable)
   hits on every subsequent render.
   ────────────────────────────────────────────────────────────────── */

const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "";

function attachmentUrls(a: MessageAttachment): { full: string; thumb: string } {
  if (a.provider === "r2" && R2_PUBLIC_URL) {
    const base = R2_PUBLIC_URL.replace(/\/$/, "");
    return {
      full: `${base}/${a.storage_path}`,
      thumb: a.mime_type.startsWith("image/")
        ? `${base}/${a.storage_path}__600.webp`
        : `${base}/${a.storage_path}`,
    };
  }
  // Supabase fallback — token-less proxy with server-side image transform
  return {
    full: `/api/attach/${a.id}`,
    thumb: `/api/attach/${a.id}?w=600&q=80`,
  };
}

const RawAttachmentPreview = function AttachmentPreview({
  attachment: a,
  onDark,
}: {
  attachment: MessageAttachment;
  onDark: boolean;
}) {
  const isImage = a.mime_type.startsWith("image/");
  const sizeKb = (a.size_bytes / 1024).toFixed(0);
  const { full: fullUrl, thumb: thumbUrl } = attachmentUrls(a);

  if (isImage) {
    return (
      <div className="relative inline-block group/att rounded-lg overflow-hidden max-w-xs">
        <a
          href={fullUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
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
        <a
          href={fullUrl}
          download={a.file_name}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "absolute top-1.5 right-1.5 size-8 rounded-full bg-black/60 text-white",
            "flex items-center justify-center backdrop-blur-sm shadow-md",
            "opacity-80 group-hover/att:opacity-100 hover:scale-110 transition",
          )}
          title="İndir"
          onClick={(e) => e.stopPropagation()}
        >
          <Download className="size-4" />
        </a>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border px-2.5 py-1.5 max-w-xs",
        onDark ? "bg-black/10 border-white/20" : "bg-card border-muted",
      )}
    >
      <a
        href={fullUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 min-w-0 flex-1 hover:opacity-80 transition"
      >
        <div
          className={cn(
            "size-9 rounded-md flex items-center justify-center shrink-0",
            "bg-amber-500/15",
          )}
        >
          <FileText className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold truncate">{a.file_name}</div>
          <div className="text-[10px] opacity-70 tabular-nums">
            {sizeKb} KB · {a.mime_type.split("/")[1] ?? a.mime_type}
          </div>
        </div>
      </a>
      <a
        href={fullUrl}
        download={a.file_name}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "size-7 rounded-md flex items-center justify-center shrink-0",
          "border transition hover:scale-105",
          onDark
            ? "bg-white/10 border-white/20 hover:bg-white/20"
            : "bg-background hover:bg-muted",
        )}
        title="İndir"
      >
        <Download className="size-3.5" />
      </a>
    </div>
  );
};

// Memoize on attachment id. The URL is now deterministic and the
// component is essentially pure on (id, onDark), so a single shallow
// compare on those two is enough to skip every re-render that doesn't
// touch this attachment.
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
