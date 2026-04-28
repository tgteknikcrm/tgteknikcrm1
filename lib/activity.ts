// Server-side helper to emit activity events.
// Call from any server action *after* a successful write so the feed
// captures who did what. Snapshots actor name + entity label so the log
// stays readable even after the underlying record is deleted.

import { createClient } from "@/lib/supabase/server";
import type { ActivityEventType } from "@/lib/supabase/types";

export interface RecordEventInput {
  type: ActivityEventType;
  entity_type?: string;
  entity_id?: string | null;
  entity_label?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function recordEvent(input: RecordEventInput): Promise<void> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let actorName: string | null = null;
    if (user) {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", user.id)
        .single();
      actorName = data?.full_name || data?.phone || null;
    }

    await supabase.from("activity_events").insert({
      event_type: input.type,
      actor_id: user?.id ?? null,
      actor_name: actorName,
      entity_type: input.entity_type ?? null,
      entity_id: input.entity_id ?? null,
      entity_label: input.entity_label ?? null,
      metadata: input.metadata ?? null,
    });
  } catch {
    // Best-effort logging — never let an event failure break the action.
  }
}
