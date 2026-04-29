"use server";

import { createClient } from "@/lib/supabase/server";

// Heartbeat — update profiles.last_seen_at to "now" so other clients
// can render "online" / "5 min ago". Called from <PresenceHeartbeat />
// every 30 seconds while the tab is visible.
export async function pingPresence() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthorized" };
  const { error } = await supabase
    .from("profiles")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) return { error: error.message };
  return { success: true };
}
