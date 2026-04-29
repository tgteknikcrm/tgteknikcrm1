"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Search,
  Plus,
  Users,
  Pin,
  PinOff,
  Archive,
  ArchiveRestore,
  Tag,
  Inbox,
  Check,
  MoreHorizontal,
  Loader2,
} from "lucide-react";
import { NewConversationDialog } from "./new-conversation-dialog";
import {
  CONVERSATION_TAG_PRESETS,
  presenceLabel,
  readableTextOn,
  tagMeta,
  type Conversation,
  type Profile,
} from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import {
  setConversationArchived,
  setConversationPinned,
  setConversationTags,
} from "./actions";

interface Item {
  conversation: Conversation;
  participants: Array<
    Pick<Profile, "id" | "full_name" | "phone" | "last_seen_at">
  >;
  unreadCount: number;
  myLastReadAt: string | null;
  archivedAt: string | null;
  pinnedAt: string | null;
  tags: string[];
}

interface Props {
  items: Item[];
  currentUserId: string;
  activeId: string | null;
  people: Array<Pick<Profile, "id" | "full_name" | "phone" | "last_seen_at">>;
}

type TabKey = "inbox" | "archive" | string; // arbitrary tag key

function relativeTimeShort(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "şimdi";
  if (sec < 3600) return `${Math.floor(sec / 60)}d`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}sa`;
  if (sec < 604800) return `${Math.floor(sec / 86400)}g`;
  return d.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
  });
}

function initialsFor(text: string | null | undefined): string {
  if (!text) return "?";
  return text
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function displayTitle(it: Item, currentUserId: string): string {
  const c = it.conversation;
  if (c.kind === "group") return c.title || "Grup";
  const other = it.participants.find((p) => p.id !== currentUserId);
  return other?.full_name || other?.phone || "—";
}

export function ConversationList({
  items,
  currentUserId,
  activeId,
  people,
}: Props) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<TabKey>("inbox");

  // Realtime: keep the list fresh when messages land in any of my
  // conversations or my participant row changes (last_read, archive,
  // pin, tags). We just trigger a server refresh — the page is a server
  // component so this rebuilds the items array with the latest state.
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel("convo-list")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => {
          router.refresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        () => {
          router.refresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversation_participants" },
        () => {
          router.refresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => {
          router.refresh();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [router]);

  // Build a list of tag keys actually used by this user (so the tabs reflect
  // what the user has, not the static palette).
  const usedTags = useMemo(() => {
    const s = new Set<string>();
    for (const it of items) for (const t of it.tags) s.add(t);
    return Array.from(s);
  }, [items]);

  const counts = useMemo(() => {
    const c = { inbox: 0, archive: 0 } as Record<string, number>;
    for (const it of items) {
      if (it.archivedAt) c.archive++;
      else c.inbox++;
      for (const t of it.tags) c[t] = (c[t] ?? 0) + 1;
    }
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    const term = q.trim().toLocaleLowerCase("tr");
    let list = items.filter((it) => {
      if (tab === "inbox") return !it.archivedAt;
      if (tab === "archive") return !!it.archivedAt;
      return it.tags.includes(tab) && !it.archivedAt;
    });
    if (term) {
      list = list.filter((it) => {
        const title = displayTitle(it, currentUserId).toLocaleLowerCase("tr");
        return (
          title.includes(term) ||
          (it.conversation.last_message_preview ?? "")
            .toLocaleLowerCase("tr")
            .includes(term)
        );
      });
    }
    // Sort: pinned first (newest pinned on top), then by last_message_at
    return list.sort((a, b) => {
      if (!!a.pinnedAt !== !!b.pinnedAt) return a.pinnedAt ? -1 : 1;
      if (a.pinnedAt && b.pinnedAt) {
        return (
          new Date(b.pinnedAt).getTime() - new Date(a.pinnedAt).getTime()
        );
      }
      const ta = a.conversation.last_message_at
        ? new Date(a.conversation.last_message_at).getTime()
        : 0;
      const tb = b.conversation.last_message_at
        ? new Date(b.conversation.last_message_at).getTime()
        : 0;
      return tb - ta;
    });
  }, [items, q, tab, currentUserId]);

  return (
    <>
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between gap-2 bg-card/30 backdrop-blur-sm">
        <h2 className="font-bold text-base">Mesajlar</h2>
        <NewConversationDialog
          currentUserId={currentUserId}
          people={people}
          trigger={
            <Button size="sm" className="h-8 px-2.5 gap-1.5 transition hover:scale-[1.03]">
              <Plus className="size-4" /> Yeni
            </Button>
          }
        />
      </div>

      {/* Search */}
      <div className="p-2 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Konuşma ara…"
            className="pl-9 h-9 bg-background transition focus-visible:ring-2"
          />
        </div>
      </div>

      {/* Outlook-style tabs: Inbox / Archive / used tags */}
      <div className="px-2 py-1.5 border-b flex items-center gap-1 overflow-x-auto">
        <TabPill
          active={tab === "inbox"}
          onClick={() => setTab("inbox")}
          icon={<Inbox className="size-3.5" />}
          label="Gelen"
          count={counts.inbox ?? 0}
        />
        <TabPill
          active={tab === "archive"}
          onClick={() => setTab("archive")}
          icon={<Archive className="size-3.5" />}
          label="Arşiv"
          count={counts.archive ?? 0}
        />
        {usedTags.map((t) => {
          const meta = tagMeta(t);
          return (
            <TabPill
              key={t}
              active={tab === t}
              onClick={() => setTab(t)}
              icon={<span className={cn("size-2 rounded-full", meta.dot)} />}
              label={meta.name}
              count={counts[t] ?? 0}
            />
          );
        })}
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground animate-tg-fade-in">
            {items.length === 0 ? (
              <>
                Henüz konuşma yok.
                <br />
                Sağ üstten <strong>Yeni</strong> ile başlat.
              </>
            ) : tab === "archive" ? (
              <>Arşivde mesaj yok.</>
            ) : (
              <>Bu sekmede konuşma yok.</>
            )}
          </div>
        ) : (
          <ul className="divide-y tg-stagger">
            {filtered.map((it) => (
              <ConvoRow
                key={it.conversation.id}
                item={it}
                currentUserId={currentUserId}
                active={it.conversation.id === activeId}
              />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function TabPill({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-primary text-primary-foreground border-primary shadow-sm"
          : "bg-card text-muted-foreground hover:bg-muted border-transparent",
      )}
    >
      {icon}
      <span>{label}</span>
      {count > 0 && (
        <span
          className={cn(
            "h-4 min-w-4 px-1 rounded-full text-[9px] font-bold tabular-nums flex items-center justify-center",
            active ? "bg-white/25 text-white" : "bg-muted-foreground/15",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function ConvoRow({
  item,
  currentUserId,
  active,
}: {
  item: Item;
  currentUserId: string;
  active: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [menuOpen, setMenuOpen] = useState(false);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);

  const c = item.conversation;
  const title = displayTitle(item, currentUserId);
  const isGroup = c.kind === "group";
  const accent = c.color || "#3b82f6";
  const initials = initialsFor(title);
  const unread = item.unreadCount;
  const isArchived = !!item.archivedAt;
  const isPinned = !!item.pinnedAt;
  // For DMs, show the other user's online state on the avatar.
  const otherForPresence = !isGroup
    ? item.participants.find((p) => p.id !== currentUserId)
    : null;
  const [otherOnline] = presenceLabel(
    otherForPresence?.last_seen_at ?? null,
  );

  function togglePin(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen(false);
    startTransition(async () => {
      const r = await setConversationPinned(c.id, !isPinned);
      if (r.error) toast.error(r.error);
      else toast.success(isPinned ? "Sabitleme kaldırıldı" : "Sabitlendi");
      router.refresh();
    });
  }

  function toggleArchive(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen(false);
    startTransition(async () => {
      const r = await setConversationArchived(c.id, !isArchived);
      if (r.error) toast.error(r.error);
      else toast.success(isArchived ? "Arşivden çıkarıldı" : "Arşivlendi");
      router.refresh();
    });
  }

  function toggleTag(key: string) {
    const next = item.tags.includes(key)
      ? item.tags.filter((t) => t !== key)
      : [...item.tags, key];
    startTransition(async () => {
      const r = await setConversationTags(c.id, next);
      if (r.error) toast.error(r.error);
      router.refresh();
    });
  }

  return (
    <li className="relative group/row">
      <Link
        href={`/messages?c=${c.id}`}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 transition-colors",
          "hover:bg-muted/60",
          active && "bg-primary/8 hover:bg-primary/8",
        )}
      >
        <div className="relative shrink-0">
          <Avatar className="size-11">
            <AvatarFallback
              className="text-sm font-bold"
              style={{
                backgroundColor: accent,
                color: readableTextOn(accent),
              }}
            >
              {isGroup ? <Users className="size-5" /> : initials}
            </AvatarFallback>
          </Avatar>
          {otherOnline && (
            <span
              className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-emerald-500 border-2 border-card"
              title="Online"
              aria-label="Online"
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span
              className={cn(
                "text-sm truncate flex items-center gap-1.5",
                unread > 0 ? "font-bold" : "font-semibold",
              )}
            >
              {isPinned && (
                <Pin className="size-3 shrink-0 text-amber-500 fill-amber-500" />
              )}
              {title}
            </span>
            <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
              {relativeTimeShort(c.last_message_at)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <span
              className={cn(
                "text-xs truncate",
                unread > 0
                  ? "text-foreground font-medium"
                  : "text-muted-foreground",
              )}
            >
              {c.last_message_preview ?? (
                <span className="italic opacity-60">Henüz mesaj yok</span>
              )}
            </span>
            {unread > 0 && (
              <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 h-5 min-w-5 rounded-full flex items-center justify-center tabular-nums shrink-0">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </div>
          {item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {item.tags.map((t) => {
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
                    <span className={cn("size-1.5 rounded-full", meta.dot)} />
                    {meta.name}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </Link>

      {/* Hover quick-actions (Outlook-style) */}
      <div
        className={cn(
          "absolute top-2 right-2 flex items-center gap-0.5 rounded-md border bg-background shadow-sm p-0.5",
          "opacity-0 group-hover/row:opacity-100 transition pointer-events-none group-hover/row:pointer-events-auto",
        )}
      >
        <button
          type="button"
          onClick={togglePin}
          disabled={pending}
          title={isPinned ? "Sabitlemeyi kaldır" : "Sabitle"}
          className="size-7 rounded hover:bg-muted flex items-center justify-center"
        >
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : isPinned ? (
            <PinOff className="size-3.5" />
          ) : (
            <Pin className="size-3.5" />
          )}
        </button>
        <button
          type="button"
          onClick={toggleArchive}
          disabled={pending}
          title={isArchived ? "Arşivden çıkar" : "Arşivle"}
          className="size-7 rounded hover:bg-muted flex items-center justify-center"
        >
          {isArchived ? (
            <ArchiveRestore className="size-3.5" />
          ) : (
            <Archive className="size-3.5" />
          )}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setTagPickerOpen((v) => !v);
            setMenuOpen(false);
          }}
          title="Etiket"
          className="size-7 rounded hover:bg-muted flex items-center justify-center"
        >
          <Tag className="size-3.5" />
        </button>
      </div>

      {tagPickerOpen && (
        <div
          className="absolute z-30 right-2 top-10 w-44 rounded-lg border bg-popover shadow-lg p-1.5 animate-tg-fade-in"
          onMouseLeave={() => setTagPickerOpen(false)}
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1.5 py-1">
            Etiketler
          </div>
          {CONVERSATION_TAG_PRESETS.filter((t) => t.key !== "arsiv").map(
            (t) => {
              const checked = item.tags.includes(t.key);
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => toggleTag(t.key)}
                  className={cn(
                    "w-full flex items-center gap-2 px-1.5 py-1 rounded text-xs transition",
                    "hover:bg-muted",
                  )}
                >
                  <span className={cn("size-2 rounded-full", t.dot)} />
                  <span className="flex-1 text-left">{t.name}</span>
                  {checked && <Check className="size-3 text-primary" />}
                </button>
              );
            },
          )}
        </div>
      )}
    </li>
  );
}
