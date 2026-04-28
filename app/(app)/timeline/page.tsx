import { PageHeader } from "@/components/app/page-header";
import { createClient, getProfile } from "@/lib/supabase/server";
import { getMachineTimeline } from "../machines/[id]/timeline-data";
import { MachineTimeline } from "../machines/[id]/timeline";

export const metadata = { title: "Zaman Çizelgesi" };

export default async function GlobalTimelinePage() {
  const supabase = await createClient();
  const profile = await getProfile();

  const [timeline, machinesRes] = await Promise.all([
    getMachineTimeline(supabase, null), // null = all machines
    supabase.from("machines").select("id, name").order("name"),
  ]);

  // Convert comments Map → plain Record for client component
  const commentsRecord: Record<
    string,
    Array<{
      id: string;
      body: string;
      author_id: string | null;
      author_name: string | null;
      created_at: string;
    }>
  > = {};
  for (const [k, v] of timeline.comments.entries()) {
    commentsRecord[k] = v;
  }

  return (
    <>
      <PageHeader
        title="Zaman Çizelgesi"
        description="Tüm makinelerin canlı akışı — üretim, kalite, bakım, sistem olayları + manuel kayıtlar tek yerde."
      />

      <MachineTimeline
        machineId={null}
        items={timeline.items}
        comments={commentsRecord}
        currentUserId={profile?.id ?? null}
        isAdmin={profile?.role === "admin"}
        machines={(machinesRes.data ?? []) as { id: string; name: string }[]}
      />
    </>
  );
}
