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
  formatMinutes,
  type Job,
  type Machine,
  type Operator,
  type Product,
  type ProductionEntry,
} from "@/lib/supabase/types";
import { JobDialog } from "./job-dialog";
import { MachineGroup } from "./machine-group";
import {
  DateRangeFilter,
  computeJobsRange,
  type JobsPeriod,
  type JobsRange,
} from "./date-range-filter";
import { cn } from "@/lib/utils";

interface Props {
  jobs: Job[];
  machines: Machine[];
  operators: Operator[];
  products: Product[];
  productionEntries: Pick<
    ProductionEntry,
    "id" | "job_id" | "produced_qty" | "scrap_qty" | "entry_date" | "created_at"
  >[];
  initialRange: JobsRange;
}

export function JobsShell({
  jobs,
  machines,
  operators,
  products,
  productionEntries,
  initialRange,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [range, setRange] = useState<JobsRange>(initialRange);
  const [q, setQ] = useState("");

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

  // Sum produced per job from production_entries.
  const producedByJob = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of productionEntries) {
      if (!e.job_id) continue;
      m.set(e.job_id, (m.get(e.job_id) ?? 0) + (e.produced_qty ?? 0));
    }
    return m;
  }, [productionEntries]);

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
        return {
          job: j,
          product: product
            ? {
                id: product.id,
                code: product.code,
                name: product.name,
                cycle_time_minutes: product.cycle_time_minutes,
                setup_time_minutes: product.setup_time_minutes,
                parts_per_setup: product.parts_per_setup,
              }
            : null,
          operator: operator
            ? { id: operator.id, full_name: operator.full_name }
            : null,
          produced,
        };
      }),
    [filtered, productById, operatorById, producedByJob],
  );

  // Group by machine (null = "Atanmamış")
  const groups = useMemo(() => {
    const map = new Map<string | "none", typeof cards>();
    for (const c of cards) {
      const key = c.job.machine_id ?? "none";
      const arr = map.get(key) ?? [];
      arr.push(c);
      map.set(key, arr);
    }
    // Render machines in sidebar order; append "none" at end if non-empty.
    const out: Array<{
      machine: Machine | null;
      cards: typeof cards;
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
  }, [cards, machines]);

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
      <div className="flex items-center gap-2 flex-wrap mb-4">
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

      {/* Empty state */}
      {groups.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={ClipboardList}
              title={
                jobs.length === 0
                  ? "Henüz iş yok"
                  : "Bu filtreye uyan iş yok"
              }
              description={
                jobs.length === 0
                  ? "İlk işi oluşturarak üretim takibine başla."
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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

// Suppress unused import
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _Unused = JobsPeriod;
