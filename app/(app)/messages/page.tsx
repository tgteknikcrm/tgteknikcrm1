import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import { ConversationList } from "./conversation-list";
import { ChatPanel } from "./chat-panel";
import { EmptyState } from "@/components/app/empty-state";
import { MessageSquare } from "lucide-react";
import type {
  Conversation,
  Profile,
  ConversationParticipant,
  MessageWithRelations,
} from "@/lib/supabase/types";

export const metadata = { title: "Mesajlar" };

interface ConvoListItem {
  conversation: Conversation;
  participants: Array<Pick<Profile, "id" | "full_name" | "phone">>;
  unreadCount: number;
  myLastReadAt: string | null;
  archivedAt: string | null;
  pinnedAt: string | null;
  tags: string[];
}

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  const { c: activeId } = await searchParams;
  const supabase = await createClient();

  // 1) My participant rows tell me which conversations I'm in + my last_read_at.
  const { data: myPartRows } = await supabase
    .from("conversation_participants")
    .select(
      "conversation_id, last_read_at, role, archived_at, pinned_at, tags, wallpaper",
    )
    .eq("user_id", profile.id);
  const myParts = (myPartRows ?? []) as Array<{
    conversation_id: string;
    last_read_at: string | null;
    role: "admin" | "member";
    archived_at: string | null;
    pinned_at: string | null;
    tags: string[];
  }>;
  const myConvIds = myParts.map((p) => p.conversation_id);

  let convos: Conversation[] = [];
  let allParts: ConversationParticipant[] = [];
  let people: Array<Pick<Profile, "id" | "full_name" | "phone">> = [];

  if (myConvIds.length > 0) {
    const [cRes, pRes] = await Promise.all([
      supabase
        .from("conversations")
        .select("*")
        .in("id", myConvIds)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("conversation_participants")
        .select("*")
        .in("conversation_id", myConvIds),
    ]);
    convos = (cRes.data ?? []) as Conversation[];
    allParts = (pRes.data ?? []) as ConversationParticipant[];
  }

  // Pull profiles for all participants + a directory for "new conversation".
  const { data: allProfiles } = await supabase
    .from("profiles")
    .select("id, full_name, phone")
    .eq("active", true);
  people = (allProfiles ?? []) as Array<
    Pick<Profile, "id" | "full_name" | "phone">
  >;
  const profileById = new Map(people.map((p) => [p.id, p]));

  // Compute unread counts per conversation in one query (count of messages
  // newer than my last_read_at, ignoring my own messages).
  const myLastReadByConv = new Map(
    myParts.map((p) => [p.conversation_id, p.last_read_at]),
  );
  let unreadByConv = new Map<string, number>();
  if (myConvIds.length > 0) {
    // We can't easily do per-conv aggregate via PostgREST without an RPC, so
    // pull the last 200 messages across my convs and count client-side.
    const { data: recent } = await supabase
      .from("messages")
      .select("id, conversation_id, author_id, created_at")
      .in("conversation_id", myConvIds)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(500);
    for (const m of recent ?? []) {
      if (m.author_id === profile.id) continue;
      const lr = myLastReadByConv.get(m.conversation_id);
      if (!lr || new Date(m.created_at) > new Date(lr)) {
        unreadByConv.set(
          m.conversation_id,
          (unreadByConv.get(m.conversation_id) ?? 0) + 1,
        );
      }
    }
  }

  // Build the sidebar list.
  const myPartByConv = new Map(myParts.map((p) => [p.conversation_id, p]));
  const items: ConvoListItem[] = convos.map((conv) => {
    const parts = allParts.filter((p) => p.conversation_id === conv.id);
    const mine = myPartByConv.get(conv.id);
    return {
      conversation: conv,
      participants: parts
        .map((p) => profileById.get(p.user_id))
        .filter((x): x is Pick<Profile, "id" | "full_name" | "phone"> => !!x),
      unreadCount: unreadByConv.get(conv.id) ?? 0,
      myLastReadAt: myLastReadByConv.get(conv.id) ?? null,
      archivedAt: mine?.archived_at ?? null,
      pinnedAt: mine?.pinned_at ?? null,
      tags: mine?.tags ?? [],
    };
  });

  // Resolve the active conversation server-side so the first paint is correct.
  const active = activeId ? convos.find((c) => c.id === activeId) ?? null : null;
  let initialMessages: MessageWithRelations[] = [];
  let activeParticipants: ConversationParticipant[] = [];
  if (active) {
    const [mRes, pRes] = await Promise.all([
      supabase
        .from("messages")
        .select(
          "*, message_attachments(id, message_id, storage_path, file_name, mime_type, size_bytes, created_at)",
        )
        .eq("conversation_id", active.id)
        .order("created_at", { ascending: true })
        .limit(200),
      supabase
        .from("conversation_participants")
        .select("*")
        .eq("conversation_id", active.id),
    ]);
    type MsgRow = MessageWithRelations & {
      message_attachments?: MessageWithRelations["attachments"];
    };
    initialMessages = ((mRes.data ?? []) as MsgRow[]).map((m) => ({
      ...m,
      attachments: m.message_attachments ?? [],
      author: m.author_id ? profileById.get(m.author_id) ?? null : null,
    }));
    activeParticipants = (pRes.data ?? []) as ConversationParticipant[];
  }
  const myActiveParticipant = active
    ? activeParticipants.find((p) => p.user_id === profile.id) ?? null
    : null;

  return (
    <div className="-m-4 md:-m-6 lg:-m-8 h-[calc(100vh-3.5rem)] grid grid-cols-1 md:grid-cols-[20rem_1fr] lg:grid-cols-[22rem_1fr] overflow-hidden">
      <aside className="border-r overflow-hidden flex-col flex bg-card/30">
        <ConversationList
          items={items}
          currentUserId={profile.id}
          activeId={active?.id ?? null}
          people={people}
        />
      </aside>

      <section className="overflow-hidden flex flex-col bg-background">
        {active ? (
          <ChatPanel
            conversation={active}
            participants={activeParticipants}
            myParticipant={myActiveParticipant}
            initialMessages={initialMessages}
            currentUserId={profile.id}
            people={people}
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
