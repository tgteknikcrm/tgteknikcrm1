"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConversationList } from "./conversation-list";
import { ChatPanel } from "./chat-panel";
import { EmptyState } from "@/components/app/empty-state";
import { MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { markConversationRead } from "./actions";
import type {
  Conversation,
  ConversationParticipant,
  MessageAttachment,
  MessageWithRelations,
  Profile,
} from "@/lib/supabase/types";

// Bound the in-memory message cache so a long-lived tab doesn't
// accumulate every conversation's history. 30 × ~200 msgs is plenty
// while keeping the working set well under a few MB.
const MAX_CACHED_CONVOS = 30;

function setBounded<T>(
  prev: Map<string, T>,
  key: string,
  value: T,
  pinKey: string | null,
): Map<string, T> {
  const next = new Map(prev);
  // Map preserves insertion order — re-set to bump to "most recent".
  next.delete(key);
  next.set(key, value);
  while (next.size > MAX_CACHED_CONVOS) {
    const oldest = next.keys().next().value;
    if (!oldest || oldest === pinKey) break;
    next.delete(oldest);
  }
  return next;
}

interface ConvoListItem {
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
  currentUserId: string;
  people: Array<
    Pick<Profile, "id" | "full_name" | "phone" | "last_seen_at">
  >;
  // Server-rendered initial state
  initialConversations: Conversation[];
  initialAllParticipants: ConversationParticipant[];
  initialMyParticipants: ConversationParticipant[];
  initialActiveId: string | null;
  initialMessages: MessageWithRelations[];
  initialActiveParticipants: ConversationParticipant[];
}

export function MessagesClient({
  currentUserId,
  people,
  initialConversations,
  initialAllParticipants,
  initialMyParticipants,
  initialActiveId,
  initialMessages,
  initialActiveParticipants,
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const profileById = useMemo(
    () => new Map(people.map((p) => [p.id, p])),
    [people],
  );

  // ── Local stores keyed off the initial server payload. From here on
  // every interaction is client-side; URL is updated via pushState so
  // refreshing or sharing the link still works.
  const [activeId, setActiveId] = useState<string | null>(initialActiveId);
  const [conversations, setConversations] = useState<Conversation[]>(
    initialConversations,
  );
  const [allParticipants, setAllParticipants] = useState<ConversationParticipant[]>(
    initialAllParticipants,
  );
  const [myParticipants, setMyParticipants] = useState<ConversationParticipant[]>(
    initialMyParticipants,
  );

  // Caches: messages + participants per conversation. Populated on first
  // open, refreshed via Realtime. Switching to a previously-opened convo
  // is instant.
  const [messageCache, setMessageCache] = useState<
    Map<string, MessageWithRelations[]>
  >(() => {
    const m = new Map<string, MessageWithRelations[]>();
    if (initialActiveId) m.set(initialActiveId, initialMessages);
    return m;
  });
  const [participantsCache, setParticipantsCache] = useState<
    Map<string, ConversationParticipant[]>
  >(() => {
    const m = new Map<string, ConversationParticipant[]>();
    if (initialActiveId) m.set(initialActiveId, initialActiveParticipants);
    return m;
  });
  // Conversations whose detail fetch is currently in flight. Used to
  // drive a skeleton state in ChatPanel — same UX as the sidebar route
  // navigation loading.
  const [loadingConvIds, setLoadingConvIds] = useState<Set<string>>(new Set());

  // Mirror the live activeId in a ref so non-reactive callbacks (cache
  // eviction, realtime handlers) can read it without re-subscribing.
  const activeIdRef = useRef<string | null>(activeId);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  // Per-conversation unread counts (derived locally; no server roundtrip).
  const [unreadByConv, setUnreadByConv] = useState<Map<string, number>>(
    new Map(),
  );

  /* ── Helpers ────────────────────────────────────────────────── */

  const fetchConversationDetail = useCallback(
    async (convId: string) => {
      setLoadingConvIds((prev) => {
        if (prev.has(convId)) return prev;
        const next = new Set(prev);
        next.add(convId);
        return next;
      });
      try {
        const [mRes, pRes] = await Promise.all([
          supabase
            .from("messages")
            .select(
              "*, message_attachments(id, message_id, storage_path, file_name, mime_type, size_bytes, provider, created_at)",
            )
            .eq("conversation_id", convId)
            .order("created_at", { ascending: true })
            .limit(200),
          supabase
            .from("conversation_participants")
            .select("*")
            .eq("conversation_id", convId),
        ]);
        type MsgRow = MessageWithRelations & {
          message_attachments?: MessageAttachment[];
        };
        const msgs = ((mRes.data ?? []) as MsgRow[]).map((m) => {
          const author = m.author_id
            ? profileById.get(m.author_id) ?? null
            : null;
          return {
            ...m,
            attachments: m.message_attachments ?? [],
            author: author
              ? {
                  id: author.id,
                  full_name: author.full_name,
                  phone: author.phone,
                }
              : null,
          };
        });
        setMessageCache((prev) =>
          setBounded(prev, convId, msgs, activeIdRef.current),
        );
        setParticipantsCache((prev) =>
          setBounded(
            prev,
            convId,
            (pRes.data ?? []) as ConversationParticipant[],
            activeIdRef.current,
          ),
        );
      } finally {
        setLoadingConvIds((prev) => {
          if (!prev.has(convId)) return prev;
          const next = new Set(prev);
          next.delete(convId);
          return next;
        });
      }
    },
    [supabase, profileById],
  );

  // Direct cache mutation so the UI updates the moment a server action
  // succeeds (delete / edit), even if the Realtime UPDATE event is
  // dropped by a flaky websocket. ChatPanel calls this after deleteMessage
  // and editMessage so we no longer depend on round-trip Realtime.
  const applyMessageMutation = useCallback(
    (
      convId: string,
      msgId: string,
      patch: Partial<MessageWithRelations>,
    ) => {
      setMessageCache((prev) => {
        const arr = prev.get(convId);
        if (!arr) return prev;
        const idx = arr.findIndex((m) => m.id === msgId);
        if (idx === -1) return prev;
        const next = new Map(prev);
        const updated = [...arr];
        updated[idx] = { ...updated[idx], ...patch };
        next.set(convId, updated);
        return next;
      });
    },
    [],
  );

  const selectConversation = useCallback(
    (id: string) => {
      // Optimistic: update UI immediately.
      setActiveId(id);
      // Sync URL without re-rendering the server component.
      if (typeof window !== "undefined") {
        const url = `/messages?c=${id}`;
        window.history.replaceState({}, "", url);
      }
      // Fetch in the background if we don't have it cached yet.
      if (!messageCache.has(id)) void fetchConversationDetail(id);
      // Mark as read both locally and on the server (fire-and-forget).
      setUnreadByConv((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
      void markConversationRead(id);
    },
    [messageCache, fetchConversationDetail],
  );

  /* ── Realtime: keep all caches fresh without page reloads ────── */

  // Track conversation ids for the realtime filter dependency
  const myConvIds = useMemo(
    () => myParticipants.map((p) => p.conversation_id),
    [myParticipants],
  );
  const myConvIdsKey = useMemo(() => myConvIds.slice().sort().join(","), [myConvIds]);

  useEffect(() => {
    const ch = supabase
      .channel("messages-client-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const m = payload.new as {
            id: string;
            conversation_id: string;
            author_id: string | null;
            body: string | null;
            reply_to: string | null;
            created_at: string;
            edited_at: string | null;
            deleted_at: string | null;
          };
          if (!myConvIds.includes(m.conversation_id)) return;

          // Pull attachments + author
          const { data: atts } = await supabase
            .from("message_attachments")
            .select("*")
            .eq("message_id", m.id);
          const author = m.author_id
            ? profileById.get(m.author_id) ?? null
            : null;
          const full: MessageWithRelations = {
            ...m,
            author: author
              ? {
                  id: author.id,
                  full_name: author.full_name,
                  phone: author.phone,
                }
              : null,
            attachments: (atts ?? []) as MessageAttachment[],
          };

          // Append to that conv's cache (if cached)
          setMessageCache((prev) => {
            const arr = prev.get(m.conversation_id);
            if (!arr) return prev;
            if (arr.some((x) => x.id === m.id)) return prev;
            const next = new Map(prev);
            next.set(m.conversation_id, [...arr, full]);
            return next;
          });

          // Update conversation row's last_message_* (so the sidebar resorts)
          setConversations((prev) =>
            prev.map((c) =>
              c.id === m.conversation_id
                ? {
                    ...c,
                    last_message_at: m.created_at,
                    last_message_preview: m.body || "[Dosya]",
                    updated_at: m.created_at,
                  }
                : c,
            ),
          );

          // Bump unread if it's not the active conversation and not mine.
          if (m.author_id !== currentUserId && m.conversation_id !== activeId) {
            setUnreadByConv((prev) => {
              const next = new Map(prev);
              next.set(
                m.conversation_id,
                (next.get(m.conversation_id) ?? 0) + 1,
              );
              return next;
            });
          }

          // If it's the active conversation, mark as read.
          if (m.conversation_id === activeId) void markConversationRead(activeId);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        (payload) => {
          const m = payload.new as MessageWithRelations;
          setMessageCache((prev) => {
            const arr = prev.get(m.conversation_id);
            if (!arr) return prev;
            const next = new Map(prev);
            next.set(
              m.conversation_id,
              arr.map((x) =>
                x.id === m.id
                  ? {
                      ...x,
                      body: m.body,
                      edited_at: m.edited_at,
                      deleted_at: m.deleted_at,
                    }
                  : x,
              ),
            );
            return next;
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversation_participants",
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as ConversationParticipant;
          if (!row) return;
          // My participant rows
          if (row.user_id === currentUserId) {
            setMyParticipants((prev) => {
              const idx = prev.findIndex(
                (p) =>
                  p.conversation_id === row.conversation_id &&
                  p.user_id === row.user_id,
              );
              if (payload.eventType === "DELETE") {
                if (idx === -1) return prev;
                const next = [...prev];
                next.splice(idx, 1);
                return next;
              }
              if (idx === -1) return [...prev, row];
              const next = [...prev];
              next[idx] = row;
              return next;
            });
          }
          // All participants cache for the active conv
          setAllParticipants((prev) => {
            const idx = prev.findIndex(
              (p) =>
                p.conversation_id === row.conversation_id &&
                p.user_id === row.user_id,
            );
            if (payload.eventType === "DELETE") {
              if (idx === -1) return prev;
              const next = [...prev];
              next.splice(idx, 1);
              return next;
            }
            if (idx === -1) return [...prev, row];
            const next = [...prev];
            next[idx] = row;
            return next;
          });
          // Per-conv participants cache
          setParticipantsCache((prev) => {
            const arr = prev.get(row.conversation_id);
            if (!arr) return prev;
            const next = new Map(prev);
            const idx = arr.findIndex((p) => p.user_id === row.user_id);
            if (payload.eventType === "DELETE") {
              if (idx === -1) return prev;
              const a = [...arr];
              a.splice(idx, 1);
              next.set(row.conversation_id, a);
            } else if (idx === -1) {
              next.set(row.conversation_id, [...arr, row]);
            } else {
              const a = [...arr];
              a[idx] = row;
              next.set(row.conversation_id, a);
            }
            return next;
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        (payload) => {
          const row = (payload.new ?? payload.old) as Conversation;
          if (!row) return;
          // Capture "row is unknown" via a closure flag, then trigger
          // router.refresh() OUTSIDE the React updater — calling it
          // inside a setState updater throws "Cannot update a component
          // while rendering a different component" because the updater
          // can run during another component's render pass.
          let isUnknownConversation = false;
          setConversations((prev) => {
            if (payload.eventType === "DELETE") {
              return prev.filter((c) => c.id !== row.id);
            }
            const idx = prev.findIndex((c) => c.id === row.id);
            if (idx === -1) {
              isUnknownConversation = true;
              return prev;
            }
            const next = [...prev];
            next[idx] = row;
            return next;
          });
          if (isUnknownConversation) {
            // Defer past the current React work to avoid setState-in-render.
            queueMicrotask(() => router.refresh());
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, currentUserId, activeId, profileById, myConvIdsKey, router]);

  /* ── Initial unread count seed (run once) ───────────────────── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (myConvIds.length === 0) return;
      const myLastReadByConv = new Map(
        myParticipants.map((p) => [p.conversation_id, p.last_read_at]),
      );
      const { data } = await supabase
        .from("messages")
        .select("conversation_id, author_id, created_at")
        .in("conversation_id", myConvIds)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(500);
      if (cancelled) return;
      const counts = new Map<string, number>();
      for (const m of data ?? []) {
        if (m.author_id === currentUserId) continue;
        const lr = myLastReadByConv.get(m.conversation_id);
        if (!lr || new Date(m.created_at) > new Date(lr)) {
          counts.set(
            m.conversation_id,
            (counts.get(m.conversation_id) ?? 0) + 1,
          );
        }
      }
      // Don't count the conversation we're currently looking at.
      if (activeId) counts.delete(activeId);
      setUnreadByConv(counts);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, currentUserId, myConvIdsKey]);

  /* ── Build sidebar items ─────────────────────────────────────── */

  const myPartByConv = useMemo(
    () => new Map(myParticipants.map((p) => [p.conversation_id, p])),
    [myParticipants],
  );

  const items: ConvoListItem[] = useMemo(() => {
    return conversations.map((conv) => {
      const parts = allParticipants.filter(
        (p) => p.conversation_id === conv.id,
      );
      const mine = myPartByConv.get(conv.id);
      return {
        conversation: conv,
        participants: parts
          .map((p) => profileById.get(p.user_id))
          .filter(
            (
              x,
            ): x is Pick<
              Profile,
              "id" | "full_name" | "phone" | "last_seen_at"
            > => !!x,
          ),
        unreadCount: unreadByConv.get(conv.id) ?? 0,
        myLastReadAt: mine?.last_read_at ?? null,
        archivedAt: mine?.archived_at ?? null,
        pinnedAt: mine?.pinned_at ?? null,
        tags: mine?.tags ?? [],
      };
    });
  }, [conversations, allParticipants, myPartByConv, profileById, unreadByConv]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );
  const activeMessages = useMemo(
    () => (activeId ? messageCache.get(activeId) ?? [] : []),
    [activeId, messageCache],
  );
  const activeParticipantsForChat = useMemo(
    () => (activeId ? participantsCache.get(activeId) ?? [] : []),
    [activeId, participantsCache],
  );
  const myActiveParticipant = useMemo(
    () =>
      activeParticipantsForChat.find((p) => p.user_id === currentUserId) ??
      null,
    [activeParticipantsForChat, currentUserId],
  );

  return (
    <div className="-m-4 md:-m-6 lg:-m-8 h-[calc(100vh-3.5rem)] grid grid-cols-1 md:grid-cols-[20rem_1fr] lg:grid-cols-[22rem_1fr] overflow-hidden">
      <aside className="border-r overflow-hidden flex-col flex bg-card/30">
        <ConversationList
          items={items}
          currentUserId={currentUserId}
          activeId={activeId}
          people={people}
          onSelect={selectConversation}
        />
      </aside>

      <section className="overflow-hidden flex flex-col bg-background">
        {activeConversation ? (
          <ChatPanel
            conversation={activeConversation}
            participants={activeParticipantsForChat}
            myParticipant={myActiveParticipant}
            initialMessages={activeMessages}
            currentUserId={currentUserId}
            people={people}
            isLoading={
              !!activeId &&
              loadingConvIds.has(activeId) &&
              activeMessages.length === 0
            }
            onApplyMessageMutation={applyMessageMutation}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center p-8">
            <EmptyState
              icon={MessageSquare}
              title="Bir konuşma seç"
              description="Soldaki listeden bir konuşma aç ya da yeni bir mesajlaşma başlat."
            />
          </div>
        )}
      </section>
    </div>
  );
}
