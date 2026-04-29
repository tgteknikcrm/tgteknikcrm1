"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Users } from "lucide-react";
import { NewConversationDialog } from "./new-conversation-dialog";
import {
  readableTextOn,
  type Conversation,
  type Profile,
} from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

interface Item {
  conversation: Conversation;
  participants: Array<Pick<Profile, "id" | "full_name" | "phone">>;
  unreadCount: number;
  myLastReadAt: string | null;
}

interface Props {
  items: Item[];
  currentUserId: string;
  activeId: string | null;
  people: Array<Pick<Profile, "id" | "full_name" | "phone">>;
}

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

export function ConversationList({
  items,
  currentUserId,
  activeId,
  people,
}: Props) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLocaleLowerCase("tr");
    if (!term) return items;
    return items.filter((it) => {
      const title = displayTitle(it, currentUserId).toLocaleLowerCase("tr");
      return (
        title.includes(term) ||
        (it.conversation.last_message_preview ?? "")
          .toLocaleLowerCase("tr")
          .includes(term)
      );
    });
  }, [items, q, currentUserId]);

  return (
    <>
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between gap-2">
        <h2 className="font-bold text-base">Mesajlar</h2>
        <NewConversationDialog
          currentUserId={currentUserId}
          people={people}
          trigger={
            <Button size="sm" className="h-8 px-2.5 gap-1.5">
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
            className="pl-9 h-9 bg-background"
          />
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            {items.length === 0
              ? "Henüz konuşma yok. Sağ üstten Yeni ile başlat."
              : "Aramayla eşleşen konuşma yok."}
          </div>
        ) : (
          <ul className="divide-y">
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

function displayTitle(it: Item, currentUserId: string): string {
  const c = it.conversation;
  if (c.kind === "group") return c.title || "Grup";
  const other = it.participants.find((p) => p.id !== currentUserId);
  return other?.full_name || other?.phone || "—";
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
  const c = item.conversation;
  const title = displayTitle(item, currentUserId);
  const isGroup = c.kind === "group";
  const accent = c.color || "#3b82f6";
  const initials = initialsFor(title);
  const unread = item.unreadCount;

  return (
    <li>
      <Link
        href={`/messages?c=${c.id}`}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 hover:bg-muted/60 transition",
          active && "bg-primary/8 hover:bg-primary/8",
        )}
      >
        <Avatar
          className="size-11 shrink-0"
          style={{
            backgroundColor: accent,
            color: readableTextOn(accent),
          }}
        >
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
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span
              className={cn(
                "text-sm truncate",
                unread > 0 ? "font-bold" : "font-semibold",
              )}
            >
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
        </div>
      </Link>
    </li>
  );
}
