// Server-side aggregator: combines manual timeline entries, production
// entries, quality reviews and machine-related activity events into a
// single chronological feed for one machine.

import type { createClient as serverClientFn } from "@/lib/supabase/server";

export type TimelineSource = "manual" | "production" | "review" | "activity";

export interface TimelineItem {
  id: string;
  source: TimelineSource;
  kind: string; // sub-type, drives icon/color
  at: string;
  actor_id: string | null;
  actor_name: string | null;
  title: string;
  body: string | null;
  photos: string[];
  meta: Record<string, unknown> | null;
  // For manual entries: id used by reaction/comment endpoints + counts
  manual_entry_id?: string;
  likes?: number;
  dislikes?: number;
  user_reaction?: "like" | "dislike" | null;
  comment_count?: number;
}

type SupaServerClient = Awaited<ReturnType<typeof serverClientFn>>;

export async function getMachineTimeline(
  supabase: SupaServerClient,
  machineId: string,
): Promise<{
  items: TimelineItem[];
  comments: Map<string, Array<{
    id: string;
    body: string;
    author_id: string | null;
    author_name: string | null;
    created_at: string;
  }>>;
}> {
  const items: TimelineItem[] = [];
  const commentsByEntry = new Map<string, Array<{
    id: string;
    body: string;
    author_id: string | null;
    author_name: string | null;
    created_at: string;
  }>>();

  // ── Manual entries (with reactions + comment counts) ──
  const [{ data: manual }, { data: { user } }] = await Promise.all([
    supabase
      .from("machine_timeline_entries")
      .select("*")
      .eq("machine_id", machineId)
      .order("happened_at", { ascending: false })
      .limit(200),
    supabase.auth.getUser(),
  ]);

  const manualIds = (manual ?? []).map((m) => m.id as string);

  // Reactions + comments fetched in parallel
  const [reactionsRes, commentsRes] = manualIds.length
    ? await Promise.all([
        supabase
          .from("timeline_reactions")
          .select("entry_id, kind, author_id")
          .in("entry_id", manualIds),
        supabase
          .from("timeline_comments")
          .select("id, entry_id, body, author_id, author_name, created_at")
          .in("entry_id", manualIds)
          .order("created_at", { ascending: true }),
      ])
    : [{ data: [] }, { data: [] }];

  // Aggregate reactions per entry
  const reactionAgg = new Map<
    string,
    { likes: number; dislikes: number; userKind: "like" | "dislike" | null }
  >();
  for (const r of reactionsRes.data ?? []) {
    const cur = reactionAgg.get(r.entry_id) ?? {
      likes: 0,
      dislikes: 0,
      userKind: null,
    };
    if (r.kind === "like") cur.likes++;
    else cur.dislikes++;
    if (user && r.author_id === user.id) {
      cur.userKind = r.kind as "like" | "dislike";
    }
    reactionAgg.set(r.entry_id, cur);
  }

  // Comments grouped per entry
  for (const c of commentsRes.data ?? []) {
    const arr = commentsByEntry.get(c.entry_id) ?? [];
    arr.push({
      id: c.id,
      body: c.body,
      author_id: c.author_id,
      author_name: c.author_name,
      created_at: c.created_at,
    });
    commentsByEntry.set(c.entry_id, arr);
  }

  for (const m of manual ?? []) {
    const agg = reactionAgg.get(m.id) ?? { likes: 0, dislikes: 0, userKind: null };
    items.push({
      id: `manual-${m.id}`,
      source: "manual",
      kind: m.kind,
      at: m.happened_at,
      actor_id: m.author_id,
      actor_name: m.author_name,
      title: m.title || (m.body ? m.body.split("\n")[0].slice(0, 80) : ""),
      body: m.body,
      photos: (m.photo_paths ?? []) as string[],
      meta: { duration_minutes: m.duration_minutes },
      manual_entry_id: m.id,
      likes: agg.likes,
      dislikes: agg.dislikes,
      user_reaction: agg.userKind,
      comment_count: commentsByEntry.get(m.id)?.length ?? 0,
    });
  }

  // ── Production entries ──
  const { data: prod } = await supabase
    .from("production_entries")
    .select(
      `id, entry_date, shift, produced_qty, scrap_qty, downtime_minutes,
       start_time, end_time, notes, operators(full_name),
       jobs(id, job_no, customer, part_name, part_no)`,
    )
    .eq("machine_id", machineId)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);

  type ProdRow = {
    id: string;
    entry_date: string;
    shift: string;
    produced_qty: number;
    scrap_qty: number;
    downtime_minutes: number;
    start_time: string | null;
    end_time: string | null;
    notes: string | null;
    operators: { full_name: string } | null;
    jobs: {
      id: string;
      job_no: string | null;
      customer: string;
      part_name: string;
      part_no: string | null;
    } | null;
  };

  for (const p of (prod ?? []) as unknown as ProdRow[]) {
    const partLabel = p.jobs?.part_name ?? "—";
    const customer = p.jobs?.customer ?? "";
    const operator = p.operators?.full_name ?? "—";
    const bodyParts: string[] = [];
    bodyParts.push(`${p.produced_qty} adet üretildi`);
    if (p.scrap_qty > 0) bodyParts.push(`${p.scrap_qty} fire`);
    if (p.downtime_minutes > 0) bodyParts.push(`${p.downtime_minutes}dk duruş`);
    items.push({
      id: `prod-${p.id}`,
      source: "production",
      kind: p.scrap_qty > 0 ? "production_scrap" : "production",
      at: `${p.entry_date}T${p.start_time ?? "00:00"}:00`,
      actor_id: null,
      actor_name: operator,
      title: `${partLabel}${customer ? " · " + customer : ""}`,
      body: bodyParts.join(" · ") + (p.notes ? `\n${p.notes}` : ""),
      photos: [],
      meta: {
        shift: p.shift,
        produced: p.produced_qty,
        scrap: p.scrap_qty,
        downtime: p.downtime_minutes,
        job_id: p.jobs?.id,
      },
    });
  }

  // ── Quality reviews for jobs assigned to this machine ──
  const { data: jobIdsRes } = await supabase
    .from("jobs")
    .select("id, part_name")
    .eq("machine_id", machineId);
  const jobMap = new Map(
    ((jobIdsRes ?? []) as Array<{ id: string; part_name: string }>).map((j) => [
      j.id,
      j.part_name,
    ]),
  );
  const jobIds = Array.from(jobMap.keys());

  if (jobIds.length > 0) {
    const { data: reviews } = await supabase
      .from("quality_reviews")
      .select(
        `id, job_id, reviewer_role, status, notes, reviewed_at,
         reviewer:profiles!quality_reviews_reviewer_id_fkey(full_name)`,
      )
      .in("job_id", jobIds)
      .order("reviewed_at", { ascending: false })
      .limit(100);

    type RevRow = {
      id: string;
      job_id: string;
      reviewer_role: string;
      status: string;
      notes: string | null;
      reviewed_at: string;
      reviewer: { full_name: string | null } | null;
    };

    for (const r of (reviews ?? []) as unknown as RevRow[]) {
      items.push({
        id: `review-${r.id}`,
        source: "review",
        kind: `review_${r.status}`,
        at: r.reviewed_at,
        actor_id: null,
        actor_name: r.reviewer?.full_name ?? null,
        title: `${jobMap.get(r.job_id) ?? "—"} — ${r.reviewer_role} onayı`,
        body: r.notes,
        photos: [],
        meta: {
          status: r.status,
          reviewer_role: r.reviewer_role,
          job_id: r.job_id,
        },
      });
    }
  }

  // ── Machine-related activity events (status changes, deletes, shift assigns) ──
  const { data: activity } = await supabase
    .from("activity_events")
    .select("*")
    .eq("entity_type", "machine")
    .eq("entity_id", machineId)
    .order("created_at", { ascending: false })
    .limit(100);

  type ActRow = {
    id: string;
    event_type: string;
    actor_id: string | null;
    actor_name: string | null;
    entity_label: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
  };

  for (const e of (activity ?? []) as ActRow[]) {
    items.push({
      id: `activity-${e.id}`,
      source: "activity",
      kind: e.event_type,
      at: e.created_at,
      actor_id: e.actor_id,
      actor_name: e.actor_name,
      title: e.entity_label ?? "",
      body: null,
      photos: [],
      meta: e.metadata,
    });
  }

  // Sort all merged by date desc
  items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return { items, comments: commentsByEntry };
}
