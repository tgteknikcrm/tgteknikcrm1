import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import {
  MACHINE_STATUS_LABEL,
  MACHINE_STATUS_TONE,
  SHIFT_LABEL,
  toolImagePublicUrl,
  type Machine,
  type MachineStatus,
  type ProductionEntry,
  type Job,
  type JobStatus,
  type Shift,
} from "@/lib/supabase/types";
import {
  ArrowLeft,
  Factory,
  MapPin,
  Hash,
} from "lucide-react";
import { MachineDialog } from "../machine-dialog";
import { StatusButton } from "../status-button";
import { MachineInfoDialog } from "./machine-info-dialog";
import {
  MachineTabs,
  type CurrentJobInfo,
  type DowntimeRow,
  type KpiData,
  type MachineToolRow,
  type ProducedProductRow,
  type ProductionEntryRow,
  type TimelineEntryRow,
} from "./machine-tabs";
import { getProfile } from "@/lib/supabase/server";
import { cn, formatDate } from "@/lib/utils";

type EntryWithJoins = ProductionEntry & {
  operators?: { full_name: string } | null;
  jobs?: {
    id: string;
    job_no: string | null;
    customer: string;
    part_name: string;
    part_no: string | null;
    quantity: number;
    status: JobStatus;
    start_date: string | null;
    due_date: string | null;
  } | null;
};

type JobRow = Pick<
  Job,
  "id" | "job_no" | "customer" | "part_name" | "part_no" | "quantity" | "status" |
  "start_date" | "due_date" | "completed_at"
>;

type JobToolRow = {
  quantity_used: number;
  tool: {
    id: string;
    code: string | null;
    name: string;
    type: string | null;
    size: string | null;
    image_path: string | null;
  } | null;
};

export default async function MachineDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10);

  const machineRes = await supabase
    .from("machines")
    .select("*")
    .eq("id", id)
    .single();
  if (machineRes.error || !machineRes.data) notFound();
  const machine = machineRes.data as Machine;

  const profile = await getProfile();
  void profile;

  const [
    entriesRes,
    weekRes,
    todayStatsRes,
    jobsRes,
    downtimesRes,
    timelineRes,
    productLogRes,
  ] = await Promise.all([
    supabase
      .from("production_entries")
      .select(
        `*, operators(full_name),
         jobs(id, job_no, customer, part_name, part_no, quantity, status, start_date, due_date, product_id)`,
      )
      .eq("machine_id", id)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("production_entries")
      .select("entry_date, produced_qty, scrap_qty, downtime_minutes")
      .eq("machine_id", id)
      .gte("entry_date", weekAgo),
    supabase
      .from("production_entries")
      .select("produced_qty, scrap_qty, downtime_minutes")
      .eq("machine_id", id)
      .eq("entry_date", today),
    supabase
      .from("jobs")
      .select(
        "id, job_no, customer, part_name, part_no, quantity, status, start_date, due_date, completed_at, product_id",
      )
      .eq("machine_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("machine_downtime_sessions")
      .select(
        `id, status, started_at, ended_at, notes,
         job:jobs(id, part_name)`,
      )
      .eq("machine_id", id)
      .order("started_at", { ascending: false })
      .limit(50),
    supabase
      .from("machine_timeline_entries")
      .select(
        `id, kind, title, body, duration_minutes, happened_at, author_name,
         entry_status, fix_description, severity_level`,
      )
      .eq("machine_id", id)
      .in("kind", [
        "bakim",
        "ariza",
        "temizlik",
        "yag_kontrol",
        "duzeltme",
        "parca_degisimi",
      ])
      .order("happened_at", { ascending: false })
      .limit(80),
    supabase
      .from("production_entries")
      .select(
        `id, job_id, produced_qty, scrap_qty, entry_date, created_at,
         job:jobs(id, part_name, product:products(id, code, name))`,
      )
      .eq("machine_id", id)
      .order("entry_date", { ascending: false })
      .limit(500),
  ]);

  const entries = (entriesRes.data ?? []) as EntryWithJoins[];
  const weekEntries = (weekRes.data ?? []) as Array<{
    entry_date: string;
    produced_qty: number;
    scrap_qty: number;
    downtime_minutes: number;
  }>;
  const todayEntries = (todayStatsRes.data ?? []) as Array<{
    produced_qty: number;
    scrap_qty: number;
    downtime_minutes: number;
  }>;
  const jobs = (jobsRes.data ?? []) as JobRow[];

  // ── Downtime sessions ─────────────────────────────────────────
  type DowntimeRowRaw = {
    id: string;
    status: MachineStatus;
    started_at: string;
    ended_at: string | null;
    notes: string | null;
    job: { id: string; part_name: string } | null;
  };
  const downtimes: DowntimeRow[] = (
    (downtimesRes.data ?? []) as unknown as DowntimeRowRaw[]
  ).map((d) => {
    const start = new Date(d.started_at).getTime();
    const end = d.ended_at ? new Date(d.ended_at).getTime() : Date.now();
    return {
      id: d.id,
      status: d.status,
      started_at: d.started_at,
      ended_at: d.ended_at,
      elapsed_minutes: Math.max(0, Math.floor((end - start) / 60000)),
      job_part_name: d.job?.part_name ?? null,
      notes: d.notes,
    };
  });

  // ── Timeline entries (manual bakım/arıza/temizlik) ────────────
  type TimelineRaw = {
    id: string;
    kind: string;
    title: string | null;
    body: string | null;
    duration_minutes: number | null;
    happened_at: string;
    author_name: string | null;
    entry_status: string | null;
    fix_description: string | null;
    severity_level: number | null;
  };
  const allTimeline = (timelineRes.data ?? []) as TimelineRaw[];
  const bakimEntries: TimelineEntryRow[] = allTimeline.filter(
    (e) => e.kind === "bakim" || e.kind === "duzeltme" || e.kind === "parca_degisimi",
  );
  const arizaEntries: TimelineEntryRow[] = allTimeline.filter(
    (e) => e.kind === "ariza",
  );
  const temizlikEntries: TimelineEntryRow[] = allTimeline.filter(
    (e) => e.kind === "temizlik",
  );
  const yagKontrolEntries: TimelineEntryRow[] = allTimeline.filter(
    (e) => e.kind === "yag_kontrol",
  );

  // ── Products produced on this machine (aggregated) ──────────
  type ProductLogRaw = {
    id: string;
    job_id: string | null;
    produced_qty: number;
    scrap_qty: number;
    entry_date: string;
    job: {
      id: string;
      part_name: string;
      product: { id: string; code: string; name: string } | null;
    } | null;
  };
  const productLog = (productLogRes.data ?? []) as unknown as ProductLogRaw[];
  const productAgg = new Map<
    string,
    {
      product_id: string | null;
      product_code: string | null;
      product_name: string | null;
      job_set: Set<string>;
      total_produced: number;
      total_scrap: number;
      last_seen: string | null;
    }
  >();
  for (const e of productLog) {
    const pid = e.job?.product?.id ?? null;
    const key = pid ?? `__job__${e.job?.id ?? "none"}`;
    const cur = productAgg.get(key) ?? {
      product_id: pid,
      product_code: e.job?.product?.code ?? null,
      product_name: e.job?.product?.name ?? e.job?.part_name ?? null,
      job_set: new Set<string>(),
      total_produced: 0,
      total_scrap: 0,
      last_seen: null,
    };
    if (e.job?.id) cur.job_set.add(e.job.id);
    cur.total_produced += e.produced_qty ?? 0;
    cur.total_scrap += e.scrap_qty ?? 0;
    if (!cur.last_seen || e.entry_date > cur.last_seen) {
      cur.last_seen = e.entry_date;
    }
    productAgg.set(key, cur);
  }
  const products: ProducedProductRow[] = Array.from(productAgg.values())
    .map((p) => ({
      product_id: p.product_id,
      product_code: p.product_code,
      product_name: p.product_name,
      job_count: p.job_set.size,
      total_produced: p.total_produced,
      total_scrap: p.total_scrap,
      last_seen: p.last_seen,
    }))
    .sort((a, b) => b.total_produced - a.total_produced);

  // ── Production entries log (last 30 for the rapor view) ─────
  const productionLog: ProductionEntryRow[] = entries.map((e) => ({
    id: e.id,
    entry_date: e.entry_date,
    shift: e.shift,
    start_time: e.start_time,
    end_time: e.end_time,
    produced_qty: e.produced_qty ?? 0,
    scrap_qty: e.scrap_qty ?? 0,
    setup_minutes: e.setup_minutes ?? 0,
    downtime_minutes: e.downtime_minutes ?? 0,
    operator_name: e.operators?.full_name ?? null,
    job_part_name: e.jobs?.part_name ?? null,
    job_status: (e.jobs?.status ?? null) as JobStatus | null,
  }));
  void productionLog;

  // Currently producing — primary source is the JOBS table (any
  // ayar/uretimde job assigned to this machine), not production_entries.
  // Operators sometimes have a job in flight without a fresh entry today
  // (e.g., long-running setup that started yesterday); we still want to
  // show the job + its tools. Today's entry, if any, is used only to
  // surface operator/shift metadata.
  const activeJobFromList = jobs.find(
    (j) => j.status === "uretimde" || j.status === "ayar",
  ) ?? null;
  const currentEntry = activeJobFromList
    ? entries.find(
        (e) => e.entry_date === today && e.jobs?.id === activeJobFromList.id,
      ) ??
      entries.find(
        (e) => e.entry_date === today && e.jobs && e.jobs.status === "uretimde",
      ) ??
      null
    : entries.find(
        (e) => e.entry_date === today && e.jobs && e.jobs.status === "uretimde",
      ) ?? null;
  // Use the jobs-table row as source of truth so we always have the
  // canonical fields even when there's no entry today.
  const currentJobRaw =
    activeJobFromList ??
    (currentEntry?.jobs as typeof activeJobFromList | null) ??
    null;

  let currentJobTotal = 0;
  if (currentJobRaw) {
    const jobTotalRes = await supabase
      .from("production_entries")
      .select("produced_qty")
      .eq("job_id", currentJobRaw.id);
    currentJobTotal = (jobTotalRes.data ?? []).reduce(
      (s, e: { produced_qty: number }) => s + (e.produced_qty ?? 0),
      0,
    );
  }

  let currentJobToolsRaw: JobToolRow[] = [];
  if (currentJobRaw) {
    const toolsRes = await supabase
      .from("job_tools")
      .select(`quantity_used, tool:tools(id, code, name, type, size, image_path)`)
      .eq("job_id", currentJobRaw.id);
    currentJobToolsRaw = (toolsRes.data ?? []) as unknown as JobToolRow[];
  }

  const todayTotal = todayEntries.reduce((s, e) => s + (e.produced_qty ?? 0), 0);
  const todayScrap = todayEntries.reduce((s, e) => s + (e.scrap_qty ?? 0), 0);
  const todayDown = todayEntries.reduce((s, e) => s + (e.downtime_minutes ?? 0), 0);

  const weekTotal = weekEntries.reduce((s, e) => s + (e.produced_qty ?? 0), 0);
  const weekScrap = weekEntries.reduce((s, e) => s + (e.scrap_qty ?? 0), 0);
  const weekDown = weekEntries.reduce((s, e) => s + (e.downtime_minutes ?? 0), 0);

  const scrapPct =
    weekTotal + weekScrap > 0 ? (weekScrap / (weekTotal + weekScrap)) * 100 : 0;

  const shiftMinutes = weekEntries.length * 480;
  const uptimePct =
    shiftMinutes > 0 ? Math.max(0, 1 - weekDown / shiftMinutes) * 100 : 100;

  const tone = MACHINE_STATUS_TONE[machine.status];

  // "Son aktivite" — newest of (latest production entry, latest timeline
  // event, latest downtime session). Drives the green-dot indicator at
  // the top right of the hero.
  const latestSignals = [
    entries[0]?.created_at,
    allTimeline[0]?.happened_at,
    downtimes[0]?.started_at,
  ].filter((x): x is string => !!x);
  const lastActivityAt =
    latestSignals.length > 0
      ? new Date(
          Math.max(...latestSignals.map((s) => new Date(s).getTime())),
        )
      : null;

  // ── Map for client tabs ────────────────────────────────────────
  const currentJob: CurrentJobInfo | null = currentJobRaw
    ? {
        id: currentJobRaw.id,
        job_no: currentJobRaw.job_no,
        customer: currentJobRaw.customer,
        part_name: currentJobRaw.part_name,
        part_no: currentJobRaw.part_no,
        quantity: currentJobRaw.quantity,
        due_date: currentJobRaw.due_date,
        produced_total: currentJobTotal,
        operator_name: currentEntry?.operators?.full_name ?? null,
        shift_label: currentEntry?.shift
          ? SHIFT_LABEL[currentEntry.shift as Shift]
          : null,
        start_time: currentEntry?.start_time ?? null,
        end_time: currentEntry?.end_time ?? null,
        today_produced: todayTotal,
        today_scrap: todayScrap,
        today_downtime: todayDown,
      }
    : null;
  const tools: MachineToolRow[] = currentJobToolsRaw.map((jt) => ({
    name: jt.tool?.name ?? "—",
    code: jt.tool?.code ?? null,
    size: jt.tool?.size ?? null,
    quantity_used: jt.quantity_used,
    image_url: toolImagePublicUrl(jt.tool?.image_path ?? null),
  }));
  const toolHints = currentJobToolsRaw.map((jt) => ({
    name: jt.tool?.name ?? "",
    code: jt.tool?.code ?? null,
    size: jt.tool?.size ?? null,
  }));
  const kpis: KpiData = {
    todayTotal,
    todayScrap,
    todayDown,
    weekTotal,
    weekScrap,
    weekDown,
    scrapPct,
    uptimePct,
  };

  return (
    <>
      {/* Breadcrumb row — "← Tüm Makineler > Makine Adı" sol, son aktivite sağda */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
        <div className="flex items-center gap-2 text-sm">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-7 px-2 -ml-2 text-muted-foreground hover:text-foreground"
          >
            <Link href="/machines">
              <ArrowLeft className="size-4" /> Tüm Makineler
            </Link>
          </Button>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium">{machine.name}</span>
        </div>
        {lastActivityAt && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="size-2 rounded-full bg-emerald-500" />
            Son aktivite{" "}
            <span className="font-medium text-foreground">
              {lastActivityAt.toLocaleString("tr-TR", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        )}
      </div>

      {/* HERO — minimal: ikon + ad + meta · sağda action grubu */}
      <div className="flex items-start sm:items-center justify-between gap-4 flex-wrap mb-6">
        <div className="flex items-center gap-4 min-w-0">
          <div
            className={cn(
              "size-14 rounded-xl bg-muted flex items-center justify-center shrink-0 relative",
            )}
          >
            <Factory className="size-7 text-foreground" />
            {machine.status === "aktif" && (
              <span className="absolute -top-1 -right-1 size-3 rounded-full bg-emerald-500 border-2 border-background" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight leading-tight">
                {machine.name}
              </h1>
              <Badge
                variant="outline"
                className={cn(
                  "h-6 gap-1.5 text-[11px] font-medium",
                  tone.badge,
                )}
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    tone.dot,
                    machine.status === "aktif" && "animate-pulse",
                  )}
                />
                {MACHINE_STATUS_LABEL[machine.status]}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-x-2 gap-y-0.5 flex-wrap">
              <span>Eklendi: {formatDate(machine.created_at)}</span>
              {machine.type && <span>· {machine.type}</span>}
              {machine.model && <span>· {machine.model}</span>}
              {machine.serial_no && (
                <span className="font-mono">· S/N {machine.serial_no}</span>
              )}
              {machine.location && (
                <span className="inline-flex items-center gap-1">
                  · <MapPin className="size-3" /> {machine.location}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusButton machineId={machine.id} current={machine.status} />
          <MachineDialog
            machine={machine}
            trigger={
              <Button variant="outline" size="sm">
                Düzenle
              </Button>
            }
          />
          <MachineInfoDialog machine={machine} />
        </div>
      </div>

      {/* Tabs replace the previous card layout — Profil / İstatistik /
          Üretim / Duruşlar / Bakım / Arıza / Temizlik. Soldan sağa
          underline indicator. */}
      <MachineTabs
        machineId={machine.id}
        machineStatus={machine.status}
        currentJob={currentJob}
        toolHints={toolHints}
        tools={tools}
        products={products}
        downtimes={downtimes}
        bakimEntries={bakimEntries}
        arizaEntries={arizaEntries}
        temizlikEntries={temizlikEntries}
        yagKontrolEntries={yagKontrolEntries}
        productionLog={productionLog}
        kpis={kpis}
      />


    </>
  );
}

// All sub-components moved into machine-tabs.tsx — page.tsx is now a
// thin server wrapper that fetches data and hands off to the tabs.
