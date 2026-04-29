"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

// Topbar messages button. Polls + realtime-updates the unread count of any
// conversation the current user participates in (excluding their own messages).
export function MessagesButton() {
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // 1) Get my conversation_participants rows with last_read_at + role.
    const { data: parts } = await supabase
      .from("conversation_participants")
      .select("conversation_id, last_read_at")
      .eq("user_id", user.id);
    if (!parts || parts.length === 0) {
      setUnread(0);
      return;
    }
    type PartRow = { conversation_id: string; last_read_at: string | null };
    const rows = parts as PartRow[];
    const lastReadByConv = new Map(rows.map((p) => [p.conversation_id, p.last_read_at]));
    const convIds = rows.map((p) => p.conversation_id);

    // 2) Fetch recent (non-deleted) messages and count unread, excluding mine.
    const { data: msgs } = await supabase
      .from("messages")
      .select("conversation_id, author_id, created_at")
      .in("conversation_id", convIds)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(500);
    let count = 0;
    for (const m of msgs ?? []) {
      if (m.author_id === user.id) continue;
      const lr = lastReadByConv.get(m.conversation_id);
      if (!lr || new Date(m.created_at) > new Date(lr)) count++;
    }
    setUnread(count);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Live updates: refresh whenever a new message lands in any of my convos.
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel("topbar-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => {
          void refresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversation_participants" },
        () => {
          // last_read_at changed → recount
          void refresh();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [refresh]);

  return (
    <Button
      asChild
      variant="ghost"
      size="icon"
      className="relative size-9"
      title="Mesajlar"
    >
      <Link href="/messages">
        <MessageSquare className={cn("size-5", unread > 0 && "text-primary")} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center tabular-nums shadow">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Link>
    </Button>
  );
}
