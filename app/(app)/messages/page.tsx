import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import { MessagesClient } from "./messages-client";
import type {
  Conversation,
  ConversationParticipant,
  MessageAttachment,
  MessageWithRelations,
  Profile,
} from "@/lib/supabase/types";

export const metadata = { title: "Mesajlar" };

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  const { c: requestedActiveId } = await searchParams;
  const supabase = await createClient();

  // 1) My participant rows tell me which conversations I'm in.
  const { data: myPartRows } = await supabase
    .from("conversation_participants")
    .select("*")
    .eq("user_id", profile.id);
  const myParts = (myPartRows ?? []) as ConversationParticipant[];
  const myConvIds = myParts.map((p) => p.conversation_id);

  let convos: Conversation[] = [];
  let allParts: ConversationParticipant[] = [];
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

  // Active people directory (used for both the picker + the per-message
  // author resolution on the client).
  const { data: allProfiles } = await supabase
    .from("profiles")
    .select("id, full_name, phone, last_seen_at")
    .eq("active", true);
  const people = (allProfiles ?? []) as Array<
    Pick<Profile, "id" | "full_name" | "phone" | "last_seen_at">
  >;
  const profileById = new Map(people.map((p) => [p.id, p]));

  // Resolve initial active conversation id. Falls back to the most recent
  // one the user is part of; null only if they have zero conversations.
  const initialActiveId =
    (requestedActiveId &&
      convos.some((c) => c.id === requestedActiveId) &&
      requestedActiveId) ||
    convos[0]?.id ||
    null;

  // Fetch messages + participants for the *initial* active conversation
  // only — every subsequent switch is client-side from cache.
  let initialMessages: MessageWithRelations[] = [];
  let initialActiveParticipants: ConversationParticipant[] = [];
  if (initialActiveId) {
    const [mRes, pRes] = await Promise.all([
      supabase
        .from("messages")
        .select(
          "*, message_attachments(id, message_id, storage_path, file_name, mime_type, size_bytes, created_at)",
        )
        .eq("conversation_id", initialActiveId)
        .order("created_at", { ascending: true })
        .limit(200),
      supabase
        .from("conversation_participants")
        .select("*")
        .eq("conversation_id", initialActiveId),
    ]);
    type MsgRow = MessageWithRelations & {
      message_attachments?: MessageAttachment[];
    };
    initialMessages = ((mRes.data ?? []) as MsgRow[]).map((m) => {
      const author = m.author_id ? profileById.get(m.author_id) ?? null : null;
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
    initialActiveParticipants = (pRes.data ?? []) as ConversationParticipant[];
  }

  return (
    <MessagesClient
      currentUserId={profile.id}
      people={people}
      initialConversations={convos}
      initialAllParticipants={allParts}
      initialMyParticipants={myParts}
      initialActiveId={initialActiveId}
      initialMessages={initialMessages}
      initialActiveParticipants={initialActiveParticipants}
    />
  );
}
