"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/app/empty-state";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Cog,
  Hourglass,
  Plus,
  Search,
  TrendingUp,
} from "lucide-react";
import {
  calcJobTimeline,
  DEFAULT_WORK_SCHEDULE,
  formatMinutes,
  type Job,
  type Machine,
  type MachineStatus,
  type Operator,
  type Product,
  type ProductionEntry,
  type WorkSchedule,
} from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import { JobDialog } from "./job-dialog";
import { MachineGroup } from "./machine-group";
import { DateRangeFilter } from "./date-range-filter";
import {
  computeJobsRange,
  type JobsPeriod,
  type JobsRange,
} from "./jobs-range";
import { cn } from "@/lib/utils";

/** Row from v_machine_active_downtime view — one per OPEN session. */
export interface ActiveDowntimeRow {
  machine_id: string;
  status: MachineStatus;
  started_at: string;
  job_id: string | null;
  production_entry_id: string | null;
}

interface Props {
  jobs: Job[];
  machines: Machine[];
  operators: Operator[];
  products: Product[];
  productionEntries: Pick<
    ProductionEntry,
    | "id"
    | "job_id"
    | "produced_qty"
    | "scrap_qty"
    | "downtime_minutes"
    | "setup_minutes"
    | "entry_date"
    | "created_at"
  >[];
  activeDowntime?: ActiveDowntimeRow[];
  initialRange: JobsRange;
  workSchedule?: WorkSchedule;
}

export function JobsShell({
  jobs,
  machines,
  operators,
  products,
  productionEntries,
  activeDowntime = [],
  initialRange,
  workSchedule = DEFAULT_WORK_SCHEDULE,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [range, setRange] = useState<JobsRange>(initialRange);
  const [q, setQ] = useState("");
  // Status tab — splits the page into Aktif (beklemede/ayar/uretimde),
  // Biten (tamamlandi) and İptal (iptal). User asked: "biten devam
  // eden ve iptal edilenlerde görünsün". Default is "aktif" because
  // that's where work-in-progress lives.
  const [statusTab, setStatusTab] = useState<"aktif" | "biten" | "iptal">(
    "aktif",
  );

  // ── Realtime: when a machine flips status (e.g. operator starts a
  // breakdown from /machines or /breakdowns), or a downtime session
  // opens/closes, refresh the page so cards reflect the new state
  // immediately. The user's complaint "anlık olarak durması gerekir
  // sayfa yenilendiğinde değil" — this is the fix.
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel("jobs-machine-status")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "machines" },
        () => router.refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "machine_downtime_sessions",
        },
        () => router.refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "production_entries",
        },
        () => router.refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [router]);

  // Sync URL on range change so refresh preserves the view.
  useEffect(() => {
    const p = new URLSearchParams(searchParams.toString());
    if (range.period !== "all") p.set("period", range.period);
    else p.delete("period");
    if (range.from) p.set("from", range.from);
    else p.delete("from");
    if (range.to) p.set("to", range.to);
    else p.delete("to");
    const next = `${pathname}?${p.toString()}`;
    if (
      next !==
      `${pathname}?${searchParams.toString()}`
    ) {
      router.replace(next, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const productById = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );
  const operatorById = useMemo(
    () => new Map(operators.map((o) => [o.id, o])),
    [operators],
  );

  // Sum produced + total stats per job from production_entries.
  // totalDowntime is what we subtract from elapsed in calcLiveProduced
  // (it's the time the trigger has already credited from closed
  // sessions). totalSetup/totalScrap power the completed-job summary.
  const aggByJob = useMemo(() => {
    const m = new Map<
      string,
      {
        produced: number;
        scrap: number;
        setup: number;
        setupEntryCount: number;
        downtime: number;
      }
    >();
    for (const e of productionEntries) {
      if (!e.job_id) continue;
      const cur = m.get(e.job_id) ?? {
        produced: 0,
        scrap: 0,
        setup: 0,
        setupEntryCount: 0,
        downtime: 0,
      };
      cur.produced += e.produced_qty ?? 0;
      cur.scrap += e.scrap_qty ?? 0;
      const entrySetup = e.setup_minutes ?? 0;
      cur.setup += entrySetup;
      // Count entries that actually recorded a setup — drives the
      // "average actual setup time" override for ETA. Skipping zeros
      // means a single 5 dk measurement isn't diluted by other shifts'
      // entries that didn't include any ayar.
      if (entrySetup > 0) cur.setupEntryCount += 1;
      cur.downtime += e.downtime_minutes ?? 0;
      m.set(e.job_id, cur);
    }
    return m;
  }, [productionEntries]);
  const producedByJob = useMemo(() => {
    const m = new Map<string, number>();
    for (const [k, v] of aggByJob) m.set(k, v.produced);
    return m;
  }, [aggByJob]);

  // Open downtime sessions keyed by machine_id (one per machine).
  const downtimeByMachine = useMemo(() => {
    const m = new Map<string, ActiveDowntimeRow>();
    for (const row of activeDowntime) m.set(row.machine_id, row);
    return m;
  }, [activeDowntime]);

  const machineById = useMemo(
    () => new Map(machines.map((mc) => [mc.id, mc])),
    [machines],
  );

  // Today's running entry stats per job (TR local date).
  const todayStr = useMemo(() => {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Istanbul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }, []);
  const todayStatsByJob = useMemo(() => {
    const m = new Map<
      string,
      { produced: number; scrap: number; downtime: number; setup: number }
    >();
    for (const e of productionEntries) {
      if (!e.job_id) continue;
      if (e.entry_date !== todayStr) continue;
      const cur = m.get(e.job_id) ?? {
        produced: 0,
        scrap: 0,
        downtime: 0,
        setup: 0,
      };
      cur.produced += e.produced_qty ?? 0;
      cur.scrap += e.scrap_qty ?? 0;
      cur.downtime += e.downtime_minutes ?? 0;
      cur.setup += e.setup_minutes ?? 0;
      m.set(e.job_id, cur);
    }
    return m;
  }, [productionEntries, todayStr]);

  // Filter by date range (server already filtered, but if user changes
  // range on the client we want instant feedback — re-apply locally too).
  const dateFilteredJobs = useMemo(() => {
    const { fromIso, toIso } = computeJobsRange(range);
    if (!fromIso && !toIso) return jobs;
    return jobs.filter((j) => {
      const created = new Date(j.created_at).getTime();
      if (fromIso && created < new Date(fromIso).getTime()) return false;
      if (toIso && created > new Date(toIso).getTime()) return false;
      return true;
    });
  }, [jobs, range]);

  // Search filter
  const filtered = useMemo(() => {
    const term = q.trim().toLocaleLowerCase("tr");
    if (!term) return dateFilteredJobs;
    return dateFilteredJobs.filter((j) => {
      const product = j.product_id ? productById.get(j.product_id) : null;
      const hay = [
        j.job_no,
        j.customer,
        j.part_name,
        j.part_no,
        product?.code,
        product?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr");
      return hay.includes(term);
    });
  }, [dateFilteredJobs, q, productById]);

  // Build per-job card data
  const cards = useMemo(
    () =>
      filtered.map((j) => {
        const product = j.product_id ? productById.get(j.product_id) : null;
        const operator = j.operator_id ? operatorById.get(j.operator_id) : null;
        const produced = producedByJob.get(j.id) ?? 0;
        const today = todayStatsByJob.get(j.id) ?? {
          produced: 0,
          scrap: 0,
          downtime: 0,
          setup: 0,
        };
        const total = aggByJob.get(j.id) ?? {
          produced: 0,
          scrap: 0,
          setup: 0,
          setupEntryCount: 0,
          downtime: 0,
        };
        // Average actual setup minutes (across recorded ayar events)
        // — fed to calcJobTimeline so future setups use what THIS job
        // really takes, not the product's planned figure.
        const actualAvgSetup =
          total.setupEntryCount > 0
            ? total.setup / total.setupEntryCount
            : 0;
        const machine = j.machine_id
          ? machineById.get(j.machine_id) ?? null
          : null;
        const machineDowntime = j.machine_id
          ? downtimeByMachine.get(j.machine_id) ?? null
          : null;
        return {
          job: j,
          product: product
            ? {
                id: product.id,
                code: product.code,
                name: product.name,
                cycle_time_minutes: product.cycle_time_minutes,
                cleanup_time_minutes: product.cleanup_time_minutes,
                setup_time_minutes: product.setup_time_minutes,
                parts_per_setup: product.parts_per_setup,
              }
            : null,
          operator: operator
            ? { id: operator.id, full_name: operator.full_name }
            : null,
          produced,
          todayProduced: today.produced,
          todayScrap: today.scrap,
          todayDowntime: today.downtime,
          todaySetup: today.setup,
          // ── New: total accumulated stats (all entries for this job)
          totalScrap: total.scrap,
          totalSetup: total.setup,
          totalDowntime: total.downtime,
          actualAvgSetupMinutes: actualAvgSetup,
          // ── New: machine status + open downtime → live ticker accuracy
          machineStatus: (machine?.status ?? null) as MachineStatus | null,
          openDowntimeStartedAt:
            machineDowntime?.started_at ?? null,
          openDowntimeStatus:
            (machineDowntime?.status ?? null) as MachineStatus | null,
        };
      }),
    [
      filtered,
      productById,
      operatorById,
      producedByJob,
      todayStatsByJob,
      aggByJob,
      machineById,
      downtimeByMachine,
    ],
  );

  // Per-tab counts so the tab pills always show accurate badges,
  // independent of the user's current selection.
  const tabCounts = useMemo(() => {
    let aktif = 0;
    let biten = 0;
    let iptal = 0;
    for (const c of cards) {
      if (c.job.status === "tamamlandi") biten++;
      else if (c.job.status === "iptal") iptal++;
      else aktif++;
    }
    return { aktif, biten, iptal };
  }, [cards]);

  // Filter to the active status tab BEFORE machine grouping so empty
  // groups vanish from the page automatically.
  const tabFilteredCards = useMemo(() => {
    return cards.filter((c) => {
      if (statusTab === "biten") return c.job.status === "tamamlandi";
      if (statusTab === "iptal") return c.job.status === "iptal";
      // aktif: everything that isn't completed or cancelled
      return c.job.status !== "tamamlandi" && c.job.status !== "iptal";
    });
  }, [cards, statusTab]);

  // Group by machine (null = "Atanmamış")
  const groups = useMemo(() => {
    const map = new Map<string | "none", typeof tabFilteredCards>();
    for (const c of tabFilteredCards) {
      const key = c.job.machine_id ?? "none";
      const arr = map.get(key) ?? [];
      arr.push(c);
      map.set(key, arr);
    }
    // Render machines in sidebar order; append "none" at end if non-empty.
    const out: Array<{
      machine: Machine | null;
      cards: typeof tabFilteredCards;
    }> = [];
    for (const m of machines) {
      const list = map.get(m.id);
      if (!list || list.length === 0) continue;
      out.push({ machine: m, cards: list });
    }
    const orphan = map.get("none");
    if (orphan && orphan.length > 0) {
      out.push({ machine: null, cards: orphan });
    }
    return out;
  }, [tabFilteredCards, machines]);

  // Aggregate KPI strip across all currently-visible cards
  const kpis = useMemo(() => {
    let inProgress = 0;
    let waiting = 0;
    let completed = 0;
    let nokPredicted = 0;
    let totalRemainingMinutes = 0;
    let producedTotal = 0;
    let quantityTotal = 0;
    for (const c of cards) {
      if (c.job.status === "uretimde" || c.job.status === "ayar") inProgress++;
      else if (c.job.status === "beklemede") waiting++;
      else if (c.job.status === "tamamlandi") completed++;
      const t = calcJobTimeline({
        quantity: c.job.quantity,
        produced: c.produced,
        cycleMinutes: c.product?.cycle_time_minutes,
        cleanupMinutes: c.product?.cleanup_time_minutes,
        setupMinutes: c.product?.setup_time_minutes,
        partsPerSetup: c.product?.parts_per_setup,
      });
      totalRemainingMinutes += t.remainingTotalMinutes;
      producedTotal += c.produced;
      quantityTotal += c.job.quantity;
      // Overdue prediction: if eta > due, count it
      if (
        c.job.due_date &&
        c.job.status !== "tamamlandi" &&
        c.job.status !== "iptal"
      ) {
        const eta = new Date(Date.now() + t.remainingTotalMinutes * 60_000);
        const due = new Date(c.job.due_date);
        if (eta > due) nokPredicted++;
      }
    }
    return {
      inProgress,
      waiting,
      completed,
      nokPredicted,
      totalRemainingMinutes,
      producedTotal,
      quantityTotal,
    };
  }, [cards]);

  return (
    <>
      <PageHeader
        title="İşler / Siparişler"
        description="Makine bazlı görünüm · Adım takibi · Tahmini bitiş süresi"
        actions={
          <JobDialog
            machines={machines}
            operators={operators}
            products={products}
            trigger={
              <Button>
                <Plus className="size-4" /> Yeni İş
              </Button>
            }
          />
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
        <Kpi
          icon={Cog}
          label="Üretimde"
          value={kpis.inProgress}
          tone="emerald"
        />
        <Kpi icon={Hourglass} label="Beklemede" value={kpis.waiting} tone="zinc" />
        <Kpi
          icon={CheckCircle2}
          label="Tamamlanan"
          value={kpis.completed}
          tone="blue"
        />
        <Kpi
          icon={AlertTriangle}
          label="Geç Riski"
          value={kpis.nokPredicted}
          tone={kpis.nokPredicted > 0 ? "rose" : "zinc"}
        />
        <Kpi
          icon={TrendingUp}
          label="Toplam Kalan"
          value={
            kpis.totalRemainingMinutes > 0
              ? formatMinutes(kpis.totalRemainingMinutes)
              : "—"
          }
          stringValue
          tone="amber"
        />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <DateRangeFilter value={range} onChange={setRange} />
        <div className="relative ml-auto w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="İş no, müşteri, parça, ürün..."
            className="pl-9 h-9"
          />
        </div>
      </div>

      {/* Status tabs — Aktif / Biten / İptal. Defaults to Aktif so the
          page lands on work-in-progress; counts always reflect the
          current date+search filter. */}
      <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1">
        <StatusTab
          active={statusTab === "aktif"}
          onClick={() => setStatusTab("aktif")}
          icon={<Cog className="size-3.5" />}
          label="Devam Eden"
          count={tabCounts.aktif}
          tone="emerald"
        />
        <StatusTab
          active={statusTab === "biten"}
          onClick={() => setStatusTab("biten")}
          icon={<CheckCircle2 className="size-3.5" />}
          label="Biten"
          count={tabCounts.biten}
          tone="blue"
        />
        <StatusTab
          active={statusTab === "iptal"}
          onClick={() => setStatusTab("iptal")}
          icon={<AlertTriangle className="size-3.5" />}
          label="İptal Edilen"
          count={tabCounts.iptal}
          tone="rose"
        />
      </div>

      {/* Empty state */}
      {groups.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={ClipboardList}
              title={
                jobs.length === 0
                  ? "Henüz iş yok"
                  : statusTab === "biten"
                    ? "Henüz biten iş yok"
                    : statusTab === "iptal"
                      ? "İptal edilen iş yok"
                      : "Bu filtreye uyan iş yok"
              }
              description={
                jobs.length === 0
                  ? "İlk işi oluşturarak üretim takibine başla."
                  : statusTab === "biten"
                    ? "İşler tamamlandığında burada görünür."
                    : statusTab === "iptal"
                      ? "İptal edilen işler burada listelenir."
                      : "Tarih aralığını veya aramayı değiştir."
              }
              action={
                jobs.length === 0 ? (
                  <JobDialog
                    machines={machines}
                    operators={operators}
                    products={products}
                    trigger={
                      <Button>
                        <Plus className="size-4" /> Yeni İş
                      </Button>
                    }
                  />
                ) : null
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => {
            // Calculate per-machine remaining minutes
            let machineRemaining = 0;
            for (const c of g.cards) {
              if (c.job.status === "tamamlandi" || c.job.status === "iptal")
                continue;
              const t = calcJobTimeline({
                quantity: c.job.quantity,
                produced: c.produced,
                cycleMinutes: c.product?.cycle_time_minutes,
                setupMinutes: c.product?.setup_time_minutes,
                partsPerSetup: c.product?.parts_per_setup,
              });
              machineRemaining += t.remainingTotalMinutes;
            }
            return (
              <MachineGroup
                key={g.machine?.id ?? "none"}
                machine={g.machine}
                jobs={g.cards}
                machines={machines}
                operators={operators}
                products={products}
                totalRemainingMinutes={machineRemaining}
                workSchedule={workSchedule}
              />
            );
          })}
        </div>
      )}

      {/* Footnote with quick navigation to other pages */}
      <div className="mt-6 text-[11px] text-muted-foreground flex items-center gap-3 flex-wrap">
        <span>İlişkili sayfalar:</span>
        <Link href="/production" className="hover:text-foreground underline">
          Üretim Formları
        </Link>
        <Link href="/products" className="hover:text-foreground underline">
          Ürün Master
        </Link>
        <Link href="/quality" className="hover:text-foreground underline">
          Kalite Kontrol
        </Link>
      </div>
    </>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  stringValue = false,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  stringValue?: boolean;
  tone: "emerald" | "blue" | "amber" | "rose" | "zinc";
}) {
  const tones: Record<string, string> = {
    emerald:
      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    blue: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
    amber:
      "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
    rose: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30",
    zinc: "bg-muted text-muted-foreground border-border",
  };
  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-2.5">
        <div
          className={cn(
            "size-9 rounded-lg flex items-center justify-center border shrink-0",
            tones[tone],
          )}
        >
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          <div className="text-lg font-bold tabular-nums leading-tight truncate">
            {stringValue
              ? value
              : typeof value === "number"
                ? value.toLocaleString("tr-TR")
                : value}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Pill-style status tab with a count badge — same visual pattern as
 * the messaging conversation list. Shrinks/scrolls cleanly on mobile.
 */
function StatusTab({
  active,
  onClick,
  icon,
  label,
  count,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
  tone: "emerald" | "blue" | "rose";
}) {
  const tones: Record<string, { bg: string; text: string; ring: string }> = {
    emerald: {
      bg: "bg-emerald-500",
      text: "text-emerald-700 dark:text-emerald-300",
      ring: "ring-emerald-500/40",
    },
    blue: {
      bg: "bg-blue-500",
      text: "text-blue-700 dark:text-blue-300",
      ring: "ring-blue-500/40",
    },
    rose: {
      bg: "bg-rose-500",
      text: "text-rose-700 dark:text-rose-300",
      ring: "ring-rose-500/40",
    },
  };
  const t = tones[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? `${t.bg} text-white border-transparent shadow-sm`
          : `bg-card border-border hover:bg-muted ${t.text}`,
      )}
    >
      {icon}
      <span>{label}</span>
      {count > 0 && (
        <span
          className={cn(
            "h-4 min-w-4 px-1 rounded-full text-[10px] font-bold tabular-nums flex items-center justify-center",
            active ? "bg-white/25 text-white" : "bg-muted-foreground/15",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// Suppress unused import
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _Unused = JobsPeriod;
