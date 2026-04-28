import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { ActivityClient } from "./activity-client";
import type { ActivityEvent } from "@/lib/supabase/types";

export const metadata = { title: "Aktivite" };

export default async function ActivityPage() {
  let events: ActivityEvent[] = [];
  let lastReadAt: string | null = null;

  try {
    const supabase = await createClient();
    const [evRes, readRes] = await Promise.all([
      supabase
        .from("activity_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("activity_reads").select("last_read_at").maybeSingle(),
    ]);
    events = (evRes.data ?? []) as ActivityEvent[];
    lastReadAt =
      (readRes.data as { last_read_at: string } | null)?.last_read_at ?? null;
  } catch {
    /* not configured */
  }

  return (
    <>
      <PageHeader
        title="Aktivite Geçmişi"
        description="Atölyede olan biten her şeyin tam zaman çizelgesi — kim, ne, ne zaman."
      />
      <Card>
        <CardContent className="p-0">
          <ActivityClient initialEvents={events} initialLastReadAt={lastReadAt} />
        </CardContent>
      </Card>
    </>
  );
}
