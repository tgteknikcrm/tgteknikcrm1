import { Fragment } from "react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import {
  SHIFT_LABEL,
  type Job,
  type Machine,
  type Operator,
  type ProductionEntry,
} from "@/lib/supabase/types";
import {
  Plus,
  ClipboardList,
  TrendingUp,
  AlertTriangle,
  PauseCircle,
  FileSpreadsheet,
} from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { EntryDialog } from "./entry-dialog";
import { PeriodTabs } from "./period-tabs";
import { DeleteButton } from "../operators/delete-button";
import { deleteProductionEntry } from "./actions";
import {
  formatLongDateTR,
  periodRange,
  PRODUCTION_PERIOD_LABEL,
  turkeyTodayISO,
  type ProductionPeriod,
} from "@/lib/utils";
import { cn } from "@/lib/utils";

export const metadata = { title: "Üretim Formları" };

type EntryRow = ProductionEntry & {
  machines?: { name: string } | null;
  operators?: { full_name: string } | null;
  jobs?: { job_no: string | null; customer: string; part_name: string } | null;
};

type EntryWithJoins = ProductionEntry & {
  machine_name?: string;
  operator_name?: string;
  job_label?: string;
};

const VALID_PERIODS: ProductionPeriod[] = ["day", "week", "month", "year", "all"];

export default async function ProductionPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: periodParam } = await searchParams;
  const period: ProductionPeriod = VALID_PERIODS.includes(
    periodParam as ProductionPeriod,
  )
    ? (periodParam as ProductionPeriod)
    : "day";

  const today = turkeyTodayISO();
  const range = periodRange(period, today);

  let entries: EntryWithJoins[] = [];
  let machines: Machine[] = [];
  let operators: Operator[] = [];
  let jobs: Job[] = [];

  try {
    const supabase = await createClient();
    let entriesQuery = supabase
      .from("production_entries")
      .select(
        "*, machines(name), operators(full_name), jobs(job_no, customer, part_name)",
      )
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500);
    if (range) {
      entriesQuery = entriesQuery
        .gte("entry_date", range.from)
        .lte("entry_date", range.to);
    }
    const [eRes, mRes, oRes, jRes] = await Promise.all([
      entriesQuery,
      supabase.from("machines").select("*").order("name"),
      supabase
        .from("operators")
        .select("*")
        .eq("active", true)
        .order("full_name"),
      supabase
        .from("jobs")
        .select("*")
        .in("status", ["beklemede", "uretimde"])
        .order("created_at", { ascending: false }),
    ]);

    entries = (eRes.data ?? []).map((e: EntryRow) => ({
      ...e,
      machine_name: e.machines?.name,
      operator_name: e.operators?.full_name,
      job_label: e.jobs
        ? `${e.jobs.job_no ? e.jobs.job_no + " · " : ""}${e.jobs.customer} - ${e.jobs.part_name}`
        : undefined,
    }));
    machines = mRes.data ?? [];
    operators = oRes.data ?? [];
    jobs = jRes.data ?? [];
  } catch {
    /* not configured */
  }

  // Aggregate KPIs for the active period
  const totalProduced = entries.reduce(
    (sum, e) => sum + (e.produced_qty ?? 0),
    0,
  );
  const totalScrap = entries.reduce(
    (sum, e) => sum + (e.scrap_qty ?? 0),
    0,
  );
  const totalDowntime = entries.reduce(
    (sum, e) => sum + (e.downtime_minutes ?? 0),
    0,
  );
  const formCount = entries.length;
  const scrapPct =
    totalProduced + totalScrap > 0
      ? (totalScrap / (totalProduced + totalScrap)) * 100
      : 0;

  // Group rows by entry_date so the table shows day headers.
  const groupedByDate = entries.reduce<Map<string, EntryWithJoins[]>>(
    (m, e) => {
      const arr = m.get(e.entry_date) ?? [];
      arr.push(e);
      m.set(e.entry_date, arr);
      return m;
    },
    new Map(),
  );
  const groupedDates = Array.from(groupedByDate.keys()); // already sorted DESC by query

  return (
    <>
      <PageHeader
        title="Üretim Formları"
        description="Günlük vardiya bazlı üretim kayıtları · Tarih filtresiyle dönem özeti"
        actions={
          <EntryDialog
            machines={machines}
            operators={operators}
            jobs={jobs}
            trigger={
              <Button disabled={machines.length === 0}>
                <Plus className="size-4" /> Yeni Form
              </Button>
            }
          />
        }
      />

      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <PeriodTabs active={period} />
        <div className="text-xs text-muted-foreground tabular-nums">
          {range ? (
            <>
              <span className="font-medium text-foreground">
                {PRODUCTION_PERIOD_LABEL[period]}
              </span>{" "}
              · {formatLongDateTR(range.from)}
              {range.from !== range.to && (
                <> — {formatLongDateTR(range.to)}</>
              )}
            </>
          ) : (
            <span className="font-medium text-foreground">
              Tüm kayıtlar
            </span>
          )}
        </div>
      </div>

      {/* KPI cards for the selected period */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard
          icon={TrendingUp}
          label="Toplam Üretim"
          value={totalProduced.toLocaleString("tr-TR")}
          tone="emerald"
        />
        <KpiCard
          icon={AlertTriangle}
          label={`Fire (${scrapPct.toFixed(1)}%)`}
          value={totalScrap.toLocaleString("tr-TR")}
          tone="amber"
        />
        <KpiCard
          icon={PauseCircle}
          label="Duruş (dk)"
          value={totalDowntime.toLocaleString("tr-TR")}
          tone="rose"
        />
        <KpiCard
          icon={FileSpreadsheet}
          label="Form Sayısı"
          value={formCount.toLocaleString("tr-TR")}
          tone="blue"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {entries.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title={
                period === "all"
                  ? "Henüz üretim formu yok"
                  : `${PRODUCTION_PERIOD_LABEL[period]} için kayıt yok`
              }
              description={
                period === "all"
                  ? "İlk formu oluşturarak günlük takibe başlayın."
                  : "Başka bir dönem seç ya da yeni bir form oluştur."
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tarih</TableHead>
                  <TableHead>Vardiya</TableHead>
                  <TableHead>Makine</TableHead>
                  <TableHead>Operatör</TableHead>
                  <TableHead>İş</TableHead>
                  <TableHead className="text-right">Üretim</TableHead>
                  <TableHead className="text-right">Fire</TableHead>
                  <TableHead className="text-right">Duruş</TableHead>
                  <TableHead className="text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedDates.map((date) => {
                  const items = groupedByDate.get(date)!;
                  const dayProduced = items.reduce(
                    (s, e) => s + (e.produced_qty ?? 0),
                    0,
                  );
                  const dayScrap = items.reduce(
                    (s, e) => s + (e.scrap_qty ?? 0),
                    0,
                  );
                  const isToday = date === today;
                  return (
                    <Fragment key={date}>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableCell
                          colSpan={9}
                          className="py-2 text-xs font-semibold uppercase tracking-wider"
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span>{formatLongDateTR(date)}</span>
                            {isToday && (
                              <Badge
                                variant="outline"
                                className="h-5 text-[10px] bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                              >
                                Bugün
                              </Badge>
                            )}
                            <span className="ml-auto font-normal normal-case tracking-normal text-muted-foreground tabular-nums">
                              {items.length} kayıt · {dayProduced} üretim
                              {dayScrap > 0 && (
                                <>
                                  {" · "}
                                  <span className="text-amber-600">
                                    {dayScrap} fire
                                  </span>
                                </>
                              )}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                      {items.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell className="font-mono text-xs">
                            {e.entry_date}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {SHIFT_LABEL[e.shift]}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">
                            {e.machine_name || "—"}
                          </TableCell>
                          <TableCell>{e.operator_name || "—"}</TableCell>
                          <TableCell className="max-w-xs truncate">
                            {e.job_label || "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {e.produced_qty}
                          </TableCell>
                          <TableCell className="text-right font-mono text-amber-600">
                            {e.scrap_qty}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {e.downtime_minutes}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <EntryDialog
                                entry={e}
                                machines={machines}
                                operators={operators}
                                jobs={jobs}
                                trigger={
                                  <Button variant="ghost" size="sm">
                                    Düzenle
                                  </Button>
                                }
                              />
                              <DeleteButton
                                action={async () => {
                                  "use server";
                                  return deleteProductionEntry(e.id);
                                }}
                                confirmText="Bu üretim kaydı silinsin mi?"
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: "emerald" | "amber" | "rose" | "blue";
}) {
  const tones: Record<string, string> = {
    emerald:
      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    amber:
      "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
    rose:
      "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30",
    blue:
      "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
  };
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div
          className={cn(
            "size-10 rounded-lg flex items-center justify-center border",
            tones[tone],
          )}
        >
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          <div className="text-2xl font-bold tabular-nums leading-tight">
            {value}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
