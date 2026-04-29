"use client";

import Link from "next/link";
import { useEffect, useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  MessageSquare,
  ArrowRight,
  Inbox,
  Loader2,
  Check,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { markConversationRead } from "@/app/(app)/messages/actions";
import { formatPhoneForDisplay } from "@/lib/phone";
import { readableTextOn } from "@/lib/supabase/types";
import type {
  Conversation,
  ConversationParticipant,
  Profile,
} from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

interface PreviewItem {
  conversation: Conversation;
  others: Array<Pick<Profile, "id" | "full_name" | "phone">>;
  unread: number;
  myLastReadAt: string | null;
}

function relTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return "şimdi";
  if (sec < 3600) return `${Math.floor(sec / 60)}d`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}sa`;
  if (sec < 604800) return `${Math.floor(sec / 86400)}g`;
  return d.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
  });
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

export function MessagesButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [marking, startMarking] = useTransition();

  const fetchAll = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    setLoading(true);

    const { data: parts } = await supabase
      .from("conversation_participants")
      .select("conversation_id, last_read_at, archived_at")
      .eq("user_id", user.id);
    const myParts = (parts ?? []) as Array<{
      conversation_id: string;
      last_read_at: string | null;
      archived_at: string | null;
    }>;
    const inboxConvIds = myParts
      .filter((p) => !p.archived_at)
      .map((p) => p.conversation_id);

    if (inboxConvIds.length === 0) {
      setItems([]);
      setUnreadTotal(0);
      setLoading(false);
      return;
    }

    const lastReadByConv = new Map(
      myParts.map((p) => [p.conversation_id, p.last_read_at]),
    );

    const [convRes, allPartsRes, msgsRes] = await Promise.all([
      supabase
        .from("conversations")
        .select("*")
        .in("id", inboxConvIds)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(20),
      supabase
        .from("conversation_participants")
        .select("conversation_id, user_id")
        .in("conversation_id", inboxConvIds),
      supabase
        .from("messages")
        .select("conversation_id, author_id, created_at")
        .in("conversation_id", inboxConvIds)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(500),
    ]);
    const convos = (convRes.data ?? []) as Conversation[];
    const allParts = (allPartsRes.data ?? []) as Pick<
      ConversationParticipant,
      "conversation_id" | "user_id"
    >[];

    const otherIds = new Set<string>();
    for (const p of allParts) if (p.user_id !== user.id) otherIds.add(p.user_id);

    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, full_name, phone")
      .in("id", Array.from(otherIds));
    const profById = new Map(
      ((profilesData ?? []) as Array<
        Pick<Profile, "id" | "full_name" | "phone">
      >).map((p) => [p.id, p]),
    );

    let total = 0;
    const unreadByConv = new Map<string, number>();
    for (const m of msgsRes.data ?? []) {
      if (m.author_id === user.id) continue;
      const lr = lastReadByConv.get(m.conversation_id);
      if (!lr || new Date(m.created_at) > new Date(lr)) {
        total++;
        unreadByConv.set(
          m.conversation_id,
          (unreadByConv.get(m.conversation_id) ?? 0) + 1,
        );
      }
    }

    const previews: PreviewItem[] = convos.map((c) => {
      const others = allParts
        .filter((p) => p.conversation_id === c.id && p.user_id !== user.id)
        .map((p) => profById.get(p.user_id))
        .filter((x): x is Pick<Profile, "id" | "full_name" | "phone"> => !!x);
      return {
        conversation: c,
        others,
        unread: unreadByConv.get(c.id) ?? 0,
        myLastReadAt: lastReadByConv.get(c.id) ?? null,
      };
    });

    setItems(previews);
    setUnreadTotal(total);
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  // Realtime: any new message OR participant update should refresh.
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel("topbar-msg-popup")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => {
          void fetchAll();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversation_participants",
        },
        () => {
          void fetchAll();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [fetchAll]);

  function markOne(convId: string) {
    startMarking(async () => {
      const r = await markConversationRead(convId);
      if (!r.error) await fetchAll();
    });
  }

  function markAll() {
    startMarking(async () => {
      await Promise.all(
        items.filter((i) => i.unread > 0).map((i) => markConversationRead(i.conversation.id)),
      );
      await fetchAll();
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-9 transition hover:scale-105"
          title="Mesajlar"
        >
          <MessageSquare
            className={cn("size-5", unreadTotal > 0 && "text-primary")}
          />
          {unreadTotal > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center tabular-nums shadow">
              {unreadTotal > 9 ? "9+" : unreadTotal}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 flex flex-col gap-0"
      >
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <MessageSquare className="size-4" />
            Mesajlar
            {unreadTotal > 0 && (
              <span className="ml-2 h-5 min-w-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                {unreadTotal > 99 ? "99+" : unreadTotal}
              </span>
            )}
          </SheetTitle>
          <SheetDescription className="text-xs">
            Son konuşmalar — tıklayınca tam ekran sohbete geçer.
          </SheetDescription>
        </SheetHeader>

        <div className="flex items-center justify-between px-3 py-2 border-b">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setOpen(false)}
          >
            <Link href="/messages">
              <Inbox className="size-3.5" /> Tümünü aç
            </Link>
          </Button>
          {unreadTotal > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAll}
              disabled={marking}
              className="h-7 text-xs gap-1"
            >
              {marking ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Check className="size-3" />
              )}
              Hepsini okudum
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-6 flex items-center justify-center text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <MessageSquare className="size-10 mx-auto opacity-30 mb-2" />
              <p className="text-sm">Henüz mesaj yok.</p>
              <Button asChild size="sm" variant="outline" className="mt-3">
                <Link href="/messages" onClick={() => setOpen(false)}>
                  Konuşma başlat <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </div>
          ) : (
            <ul className="divide-y tg-stagger">
              {items.map((it) => (
                <PreviewRow
                  key={it.conversation.id}
                  item={it}
                  onOpen={() => {
                    setOpen(false);
                    router.push(`/messages?c=${it.conversation.id}`);
                  }}
                  onMarkRead={() => markOne(it.conversation.id)}
                  marking={marking}
                />
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function PreviewRow({
  item,
  onOpen,
  onMarkRead,
  marking,
}: {
  item: PreviewItem;
  onOpen: () => void;
  onMarkRead: () => void;
  marking: boolean;
}) {
  const c = item.conversation;
  const isGroup = c.kind === "group";
  const accent = c.color || "#3b82f6";
  const title = isGroup
    ? c.title || "Grup"
    : item.others[0]?.full_name ||
      formatPhoneForDisplay(item.others[0]?.phone ?? null) ||
      "—";

  return (
    <li className="relative group/msg-row">
      <button
        type="button"
        onClick={onOpen}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/60 transition"
      >
        <Avatar className="size-10 shrink-0">
          <AvatarFallback
            className="text-xs font-bold"
            style={{ backgroundColor: accent, color: readableTextOn(accent) }}
          >
            {isGroup ? <Users className="size-4" /> : initials(title)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span
              className={cn(
                "text-sm truncate",
                item.unread > 0 ? "font-bold" : "font-semibold",
              )}
            >
              {title}
            </span>
            <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
              {relTime(c.last_message_at)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <span
              className={cn(
                "text-xs truncate",
                item.unread > 0
                  ? "text-foreground font-medium"
                  : "text-muted-foreground",
              )}
            >
              {c.last_message_preview ?? (
                <span className="italic opacity-60">Henüz mesaj yok</span>
              )}
            </span>
            {item.unread > 0 && (
              <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 h-5 min-w-5 rounded-full flex items-center justify-center tabular-nums shrink-0">
                {item.unread > 99 ? "99+" : item.unread}
              </span>
            )}
          </div>
        </div>
      </button>
      {item.unread > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMarkRead();
          }}
          disabled={marking}
          title="Okundu işaretle"
          className={cn(
            "absolute right-2 top-1/2 -translate-y-1/2 size-7 rounded-md border bg-background shadow-sm",
            "flex items-center justify-center transition opacity-0 group-hover/msg-row:opacity-100",
          )}
        >
          {marking ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Check className="size-3.5" />
          )}
        </button>
      )}
    </li>
  );
}
