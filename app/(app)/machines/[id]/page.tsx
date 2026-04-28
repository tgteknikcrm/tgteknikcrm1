import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
  MACHINE_STATUS_LABEL,
  MACHINE_STATUS_TONE,
  JOB_STATUS_LABEL,
  SHIFT_LABEL,
  type Machine,
  type ProductionEntry,
  type Job,
  type JobStatus,
  type Shift,
} from "@/lib/supabase/types";
import {
  ArrowLeft,
  Factory,
  Clock,
  User as UserIcon,
  Package,
  Target,
  TrendingUp,
  AlertTriangle,
  Percent,
  Activity,
  Wrench as WrenchIcon,
  Calendar,
  MapPin,
  Hash,
  History,
  ListChecks,
  ClipboardCheck,
  Stamp,
  ArrowRight,
} from "lucide-react";
import {
  QC_REVIEWER_ROLE_LABEL,
  QC_REVIEW_STATUS_TONE,
  QC_REVIEW_STATUS_LABEL,
  type QcResult,
} from "@/lib/supabase/types";
import { MachineDialog } from "../machine-dialog";
import { StatusButton } from "../status-button";
import { LiveTelemetry } from "./live-telemetry";
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

  const [entriesRes, weekRes, todayStatsRes, jobsRes] = await Promise.all([
    supabase
      .from("production_entries")
      .select(
        `*, operators(full_name),
         jobs(id, job_no, customer, part_name, part_no, quantity, status, start_date, due_date)`,
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
      .select("id, job_no, customer, part_name, part_no, quantity, status, start_date, due_date, completed_at")
      .eq("machine_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
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

  // Currently producing
  const currentEntry = entries.find(
    (e) => e.entry_date === today && e.jobs && e.jobs.status === "uretimde",
  ) ?? entries.find((e) => e.entry_date === today && e.jobs);
  const currentJob = currentEntry?.jobs ?? null;

  let currentJobTotal = 0;
  if (currentJob) {
    const jobTotalRes = await supabase
      .from("production_entries")
      .select("produced_qty")
      .eq("job_id", currentJob.id);
    currentJobTotal = (jobTotalRes.data ?? []).reduce(
      (s, e: { produced_qty: number }) => s + (e.produced_qty ?? 0),
      0,
    );
  }

  let currentJobTools: JobToolRow[] = [];
  if (currentJob) {
    const toolsRes = await supabase
      .from("job_tools")
      .select(`quantity_used, tool:tools(id, code, name, type, size)`)
      .eq("job_id", currentJob.id);
    currentJobTools = (toolsRes.data ?? []) as unknown as JobToolRow[];
  }

  // Quality control rollup for the current job
  let currentJobQc: {
    spec_count: number;
    measurement_count: number;
    ok: number;
    sinirda: number;
    nok: number;
    last_review: {
      reviewer_name: string | null;
      role: string;
      status: string;
      reviewed_at: string;
    } | null;
  } | null = null;
  if (currentJob) {
    const [specsRes, measRes, lastRevRes] = await Promise.all([
      supabase
        .from("quality_specs")
        .select("id", { count: "exact", head: true })
        .eq("job_id", currentJob.id),
      supabase
        .from("quality_measurements")
        .select("result")
        .eq("job_id", currentJob.id),
      supabase
        .from("quality_reviews")
        .select(
          `reviewer_role, status, reviewed_at,
           reviewer:profiles!quality_reviews_reviewer_id_fkey(full_name)`,
        )
        .eq("job_id", currentJob.id)
        .order("reviewed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    const meas = (measRes.data ?? []) as Array<{ result: QcResult }>;
    const lr = lastRevRes.data as {
      reviewer_role: string;
      status: string;
      reviewed_at: string;
      reviewer: { full_name: string | null } | null;
    } | null;
    currentJobQc = {
      spec_count: specsRes.count ?? 0,
      measurement_count: meas.length,
      ok: meas.filter((m) => m.result === "ok").length,
      sinirda: meas.filter((m) => m.result === "sinirda").length,
      nok: meas.filter((m) => m.result === "nok").length,
      last_review: lr
        ? {
            reviewer_name: lr.reviewer?.full_name ?? null,
            role: lr.reviewer_role,
            status: lr.status,
            reviewed_at: lr.reviewed_at,
          }
        : null,
    };
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

  // 7-day series
  const weekByDate = new Map<string, number>();
  for (const e of weekEntries) {
    weekByDate.set(e.entry_date, (weekByDate.get(e.entry_date) ?? 0) + (e.produced_qty ?? 0));
  }
  const days: { date: string; label: string; weekday: string; qty: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 864e5);
    const iso = d.toISOString().slice(0, 10);
    days.push({
      date: iso,
      label: d.toLocaleDateString("tr-TR", {
        day: "numeric",
        month: "short",
        timeZone: "Europe/Istanbul",
      }),
      weekday: d.toLocaleDateString("tr-TR", {
        weekday: "short",
        timeZone: "Europe/Istanbul",
      }),
      qty: weekByDate.get(iso) ?? 0,
    });
  }
  const maxQty = Math.max(1, ...days.map((d) => d.qty));

  const tone = MACHINE_STATUS_TONE[machine.status];
  const operatorInitials = currentEntry?.operators?.full_name
    ? currentEntry.operators.full_name
        .split(" ")
        .map((s) => s[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : null;

  return (
    <>
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/machines">
            <ArrowLeft className="size-4" /> Tüm Makineler
          </Link>
        </Button>
      </div>

      {/* HERO — gradient + status ring */}
      <Card
        className={cn(
          "mb-6 overflow-hidden gap-0 py-0 border-l-4",
          tone.border,
        )}
      >
        <div
          className={cn(
            "p-6 bg-gradient-to-br from-card via-card to-muted/40",
            "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4",
          )}
        >
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "size-16 rounded-2xl flex items-center justify-center border-2 shrink-0 relative",
                tone.badge,
              )}
            >
              <Factory className="size-8" />
              {machine.status === "aktif" && (
                <span className="absolute -top-1 -right-1 size-3.5 rounded-full bg-emerald-500 border-2 border-card animate-pulse" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-3xl font-bold tracking-tight">
                  {machine.name}
                </h1>
                <Badge
                  variant="outline"
                  className={cn("border gap-1.5 font-semibold", tone.badge)}
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
              <div className="flex items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground mt-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1">
                  <Hash className="size-3.5" />
                  {machine.type}
                </span>
                {machine.model && <span>· {machine.model}</span>}
                {machine.serial_no && (
                  <span className="font-mono text-xs">
                    · S/N {machine.serial_no}
                  </span>
                )}
                {machine.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" /> {machine.location}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <StatusButton machineId={machine.id} current={machine.status} />
            <MachineDialog
              machine={machine}
              trigger={<Button variant="outline">Düzenle</Button>}
            />
          </div>
        </div>
      </Card>

      {/* LIVE TELEMETRY — mock, swappable for real MTConnect/FOCAS later */}
      <LiveTelemetry
        machineId={machine.id}
        status={machine.status}
        toolHints={currentJobTools.map((jt) => ({
          name: jt.tool?.name ?? "",
          code: jt.tool?.code ?? null,
          size: jt.tool?.size ?? null,
        }))}
      />

      {/* KPI STRIP — 4 tiles in one elegant row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiTile
          icon={TrendingUp}
          label="Bugün Üretilen"
          value={todayTotal}
          unit="adet"
          accent="emerald"
        />
        <KpiTile
          icon={Target}
          label="7 Günlük Toplam"
          value={weekTotal}
          unit="adet"
          accent="blue"
          sub={`fire: ${weekScrap}`}
        />
        <KpiTile
          icon={AlertTriangle}
          label="Fire Oranı (7g)"
          value={`%${scrapPct.toFixed(1)}`}
          unit=""
          accent={scrapPct > 5 ? "red" : "amber"}
        />
        <KpiTile
          icon={Percent}
          label="Çalışma Verimi (7g)"
          value={`%${uptimePct.toFixed(0)}`}
          unit=""
          accent={uptimePct < 80 ? "amber" : "emerald"}
          sub={`duruş: ${weekDown}dk`}
        />
      </div>

      {/* CURRENTLY PRODUCING — full-width visual hero */}
      <Card
        className={cn(
          "mb-6 overflow-hidden gap-0 py-0",
          currentJob && "ring-1 ring-emerald-500/20",
        )}
      >
        <div
          className={cn(
            "h-1.5 w-full",
            currentJob ? "bg-emerald-500" : tone.dot,
          )}
        />
        <CardContent className="p-6">
          {currentJob ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-5">
                <div>
                  <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Şu An Üretiliyor
                  </div>
                  <h2 className="text-3xl font-bold tracking-tight">
                    {currentJob.part_name}
                  </h2>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground mt-1">
                    <span className="inline-flex items-center gap-1 font-mono text-xs">
                      <Hash className="size-3.5" /> {currentJob.job_no || "—"}
                    </span>
                    <span className="font-medium text-foreground/80">
                      {currentJob.customer}
                    </span>
                    {currentJob.part_no && (
                      <span className="font-mono text-xs">
                        P/N: {currentJob.part_no}
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      İlerleme
                    </span>
                    <span className="text-sm font-bold tabular-nums">
                      %
                      {currentJob.quantity > 0
                        ? Math.round((currentJobTotal / currentJob.quantity) * 100)
                        : 0}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="text-5xl font-bold font-mono tabular-nums leading-none">
                      {currentJobTotal}
                    </span>
                    <span className="text-xl text-muted-foreground tabular-nums">
                      / {currentJob.quantity}
                    </span>
                    <span className="text-sm text-muted-foreground ml-1">adet</span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          currentJob.quantity > 0
                            ? (currentJobTotal / currentJob.quantity) * 100
                            : 0,
                        )}%`,
                      }}
                    />
                  </div>
                  {currentJob.due_date && (
                    <p className="text-xs text-muted-foreground mt-2.5 inline-flex items-center gap-1.5">
                      <Calendar className="size-3" />
                      Teslim: {formatDate(currentJob.due_date)}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-4 lg:border-l lg:pl-6">
                {/* Operator avatar block */}
                <div className="flex items-start gap-3">
                  {operatorInitials ? (
                    <Avatar className="size-11 shrink-0">
                      <AvatarFallback className="font-semibold bg-primary/15 text-primary">
                        {operatorInitials}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <div className="size-11 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <UserIcon className="size-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Operatör
                    </div>
                    <div className="text-sm font-bold leading-tight truncate">
                      {currentEntry?.operators?.full_name || "—"}
                    </div>
                    {currentEntry?.shift && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {SHIFT_LABEL[currentEntry.shift as Shift]} vardiyası
                      </div>
                    )}
                  </div>
                </div>

                <InfoLine
                  icon={Clock}
                  label="Başlama / Bitiş"
                  value={`${formatTime(currentEntry?.start_time ?? null)} → ${formatTime(
                    currentEntry?.end_time ?? null,
                  )}`}
                />

                <div className="grid grid-cols-3 gap-2 pt-3 border-t">
                  <MiniStat label="Bugün" value={todayTotal} tone="default" />
                  <MiniStat label="Fire" value={todayScrap} tone="warn" />
                  <MiniStat label="Duruş" value={`${todayDown}dk`} tone="muted" />
                </div>
              </div>
            </div>
          ) : (
            <EmptyCurrentJob status={machine.status} />
          )}
        </CardContent>
      </Card>

      {/* QUALITY CONTROL — only when there's a current job */}
      {currentJob && currentJobQc && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <ClipboardCheck className="size-4 text-muted-foreground" />
              Kalite Kontrol — Aktif İş
              <Button asChild size="sm" variant="ghost" className="ml-auto h-7">
                <Link href={`/quality/${currentJob.id}`}>
                  Yönet <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {currentJobQc.spec_count === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-2">
                  Bu iş için kalite spec'i tanımlanmamış.
                </p>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/quality/${currentJob.id}`}>
                    Spec Ekle
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <QcStat label="Spec" value={currentJobQc.spec_count} />
                  <QcStat label="Ölçüm" value={currentJobQc.measurement_count} />
                  <QcStat
                    label="Kabul"
                    value={
                      currentJobQc.measurement_count > 0
                        ? `%${Math.round(
                            (currentJobQc.ok / currentJobQc.measurement_count) * 100,
                          )}`
                        : "—"
                    }
                    tone="ok"
                  />
                  <QcStat
                    label="NOK"
                    value={currentJobQc.nok}
                    tone={currentJobQc.nok > 0 ? "bad" : undefined}
                  />
                </div>

                {currentJobQc.last_review && (
                  <div className="flex items-center gap-2 pt-2 border-t flex-wrap">
                    <Stamp className="size-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      Son onay:
                    </span>
                    <span className="text-xs font-medium">
                      {currentJobQc.last_review.reviewer_name || "—"}
                    </span>
                    <Badge variant="outline" className="font-normal h-5 text-[10px]">
                      {
                        QC_REVIEWER_ROLE_LABEL[
                          currentJobQc.last_review.role as keyof typeof QC_REVIEWER_ROLE_LABEL
                        ]
                      }
                    </Badge>
                    <Badge
                      variant="outline"
                      className={cn(
                        "h-5 text-[10px]",
                        QC_REVIEW_STATUS_TONE[
                          currentJobQc.last_review
                            .status as keyof typeof QC_REVIEW_STATUS_TONE
                        ],
                      )}
                    >
                      {
                        QC_REVIEW_STATUS_LABEL[
                          currentJobQc.last_review
                            .status as keyof typeof QC_REVIEW_STATUS_LABEL
                        ]
                      }
                    </Badge>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatDate(currentJobQc.last_review.reviewed_at)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TREND CHART + TOOLS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="size-4 text-muted-foreground" />
              Son 7 Gün Üretim
              {weekTotal > 0 && (
                <Badge variant="outline" className="ml-auto font-normal tabular-nums">
                  Toplam: {weekTotal}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {weekTotal === 0 ? (
              <div className="h-40 flex flex-col items-center justify-center text-muted-foreground">
                <TrendingUp className="size-8 opacity-30 mb-2" />
                <p className="text-sm">Son 7 günde üretim kaydı yok.</p>
              </div>
            ) : (
              <div className="flex items-end gap-2 h-44 pt-4">
                {days.map((d) => {
                  const h = Math.max(6, (d.qty / maxQty) * 150);
                  const isToday = d.date === today;
                  return (
                    <div
                      key={d.date}
                      className="flex-1 flex flex-col items-center gap-1.5 group"
                    >
                      <span
                        className={cn(
                          "text-xs tabular-nums font-semibold transition",
                          isToday
                            ? "text-foreground"
                            : "text-muted-foreground group-hover:text-foreground",
                        )}
                      >
                        {d.qty || "—"}
                      </span>
                      <div
                        className={cn(
                          "w-full rounded-md transition-all relative",
                          isToday
                            ? "bg-gradient-to-t from-primary to-primary/70"
                            : "bg-muted-foreground/30 group-hover:bg-muted-foreground/50",
                        )}
                        style={{ height: `${h}px` }}
                        title={`${d.weekday} ${d.label}: ${d.qty} adet`}
                      />
                      <div className="text-center">
                        <div
                          className={cn(
                            "text-[10px] font-medium leading-tight",
                            isToday ? "text-foreground" : "text-muted-foreground",
                          )}
                        >
                          {d.weekday}
                        </div>
                        <div className="text-[9px] text-muted-foreground/60 tabular-nums">
                          {d.label}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <WrenchIcon className="size-4 text-muted-foreground" />
              Aktif İş Takımları
              {currentJobTools.length > 0 && (
                <Badge variant="outline" className="ml-auto font-normal">
                  {currentJobTools.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!currentJob ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                <WrenchIcon className="size-6 mx-auto opacity-30 mb-2" />
                Aktif iş yok.
              </div>
            ) : currentJobTools.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Bu iş için takım atanmamış.
              </p>
            ) : (
              <ul className="space-y-2">
                {currentJobTools.map((jt, i) => (
                  <li
                    key={jt.tool?.id ?? i}
                    className="flex items-center justify-between gap-2 p-2 rounded-md hover:bg-muted/50 transition"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">
                        {jt.tool?.name ?? "—"}
                      </div>
                      <div className="text-xs text-muted-foreground truncate font-mono">
                        {jt.tool?.code ?? ""}
                        {jt.tool?.size ? ` · ${jt.tool.size}` : ""}
                      </div>
                    </div>
                    <Badge variant="outline" className="tabular-nums shrink-0">
                      {jt.quantity_used}x
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* MACHINE INFO + NOTES */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-sm">Makine Bilgileri</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="Tip" value={machine.type} icon={Factory} />
            <Field label="Seri No" value={machine.serial_no} icon={Hash} />
            <Field label="Konum" value={machine.location} icon={MapPin} />
            <Field
              label="Son Güncelleme"
              value={formatDate(machine.updated_at)}
              icon={Calendar}
            />
          </div>
          {machine.notes && (
            <div className="pt-4 mt-4 border-t">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Notlar
              </div>
              <p className="text-sm whitespace-pre-wrap">{machine.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* HISTORY TABS — saves vertical space */}
      <Tabs defaultValue="jobs">
        <TabsList>
          <TabsTrigger value="jobs">
            <Package className="size-4" /> İş Geçmişi ({jobs.length})
          </TabsTrigger>
          <TabsTrigger value="entries">
            <History className="size-4" /> Üretim Kayıtları ({entries.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="jobs">
          <Card>
            <CardContent className="p-0">
              {jobs.length === 0 ? (
                <div className="p-12 text-center">
                  <ListChecks className="size-10 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-medium">İş atanmamış</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Bu makineye henüz bir iş atanmadı.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>İş No</TableHead>
                      <TableHead>Müşteri / Parça</TableHead>
                      <TableHead className="text-right">Adet</TableHead>
                      <TableHead>Durum</TableHead>
                      <TableHead>Teslim</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((j) => (
                      <TableRow key={j.id} className="hover:bg-muted/40">
                        <TableCell className="font-mono text-xs">
                          {j.job_no || "—"}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{j.part_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {j.customer}
                            {j.part_no && ` · ${j.part_no}`}
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-mono">
                          {j.quantity}
                        </TableCell>
                        <TableCell>
                          <JobStatusBadge status={j.status} />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {j.due_date ? formatDate(j.due_date) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="entries">
          <Card>
            <CardContent className="p-0">
              {entries.length === 0 ? (
                <div className="p-12 text-center">
                  <History className="size-10 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-medium">Üretim kaydı yok</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Bu makine için henüz üretim girilmemiş.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tarih</TableHead>
                      <TableHead>Vardiya</TableHead>
                      <TableHead>Operatör</TableHead>
                      <TableHead>İş / Parça</TableHead>
                      <TableHead className="text-right">Üretim</TableHead>
                      <TableHead className="text-right">Fire</TableHead>
                      <TableHead className="text-right">Duruş (dk)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((e) => (
                      <TableRow key={e.id} className="hover:bg-muted/40">
                        <TableCell className="text-sm tabular-nums">
                          {formatDate(e.entry_date)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal">
                            {SHIFT_LABEL[e.shift]}
                          </Badge>
                        </TableCell>
                        <TableCell>{e.operators?.full_name || "—"}</TableCell>
                        <TableCell>
                          {e.jobs ? (
                            <div className="text-sm">
                              <div className="font-medium">{e.jobs.part_name}</div>
                              <div className="text-xs text-muted-foreground font-mono">
                                {e.jobs.job_no || "—"}
                              </div>
                            </div>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums font-semibold">
                          {e.produced_qty}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-amber-600">
                          {e.scrap_qty || ""}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                          {e.downtime_minutes || ""}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

/* ────────────────────────────────────────────────────────── */
/* Sub-components                                            */
/* ────────────────────────────────────────────────────────── */

function KpiTile({
  icon: Icon,
  label,
  value,
  unit,
  sub,
  accent,
}: {
  icon: typeof Factory;
  label: string;
  value: number | string;
  unit?: string;
  sub?: string;
  accent: "emerald" | "blue" | "amber" | "red";
}) {
  const tones = {
    emerald: {
      bg: "bg-emerald-500/10",
      text: "text-emerald-600",
      border: "border-emerald-500/20",
    },
    blue: {
      bg: "bg-blue-500/10",
      text: "text-blue-600",
      border: "border-blue-500/20",
    },
    amber: {
      bg: "bg-amber-500/10",
      text: "text-amber-600",
      border: "border-amber-500/20",
    },
    red: {
      bg: "bg-red-500/10",
      text: "text-red-600",
      border: "border-red-500/20",
    },
  };
  const t = tones[accent];
  return (
    <Card className={cn("hover:shadow-md transition-shadow", t.border)}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "size-10 rounded-xl flex items-center justify-center shrink-0",
              t.bg,
              t.text,
            )}
          >
            <Icon className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {label}
            </div>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-bold tabular-nums leading-tight">
                {value}
              </span>
              {unit && (
                <span className="text-xs text-muted-foreground">{unit}</span>
              )}
            </div>
            {sub && (
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {sub}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InfoLine({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Factory;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="size-8 rounded-md bg-muted/60 flex items-center justify-center shrink-0">
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
          {label}
        </div>
        <div className="text-sm font-semibold leading-tight truncate">
          {value}
        </div>
      </div>
    </div>
  );
}

function QcStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "ok" | "bad";
}) {
  return (
    <div className="rounded-lg border p-2.5 bg-muted/20">
      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
        {label}
      </div>
      <div
        className={cn(
          "text-xl font-bold tabular-nums mt-0.5",
          tone === "ok" && "text-emerald-600",
          tone === "bad" && "text-red-600",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: "default" | "warn" | "muted";
}) {
  return (
    <div>
      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
        {label}
      </div>
      <div
        className={cn(
          "text-lg font-bold font-mono tabular-nums mt-0.5 leading-tight",
          tone === "warn" && "text-amber-600",
          tone === "muted" && "text-muted-foreground",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | null | undefined;
  icon: typeof Factory;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="size-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
          {label}
        </div>
        <div className="text-sm font-medium truncate">{value || "—"}</div>
      </div>
    </div>
  );
}

function EmptyCurrentJob({ status }: { status: Machine["status"] }) {
  const config = {
    ariza: {
      title: "Arızalı",
      note: "Bu makine şu an üretim yapmıyor.",
      bg: "bg-red-500/10",
      text: "text-red-600",
    },
    bakim: {
      title: "Bakımda",
      note: "Planlı bakım nedeniyle üretim duruyor.",
      bg: "bg-amber-500/10",
      text: "text-amber-600",
    },
    durus: {
      title: "Duruşta",
      note: "Üretim durduruldu.",
      bg: "bg-zinc-500/10",
      text: "text-zinc-600",
    },
    aktif: {
      title: "Boşta",
      note: "Bugün için atanmış iş yok.",
      bg: "bg-muted",
      text: "text-muted-foreground",
    },
  } as const;
  const c = config[status];
  return (
    <div className="py-8 text-center">
      <div
        className={cn(
          "size-14 rounded-2xl flex items-center justify-center mx-auto mb-3",
          c.bg,
          c.text,
        )}
      >
        <Activity className="size-7" />
      </div>
      <p className="text-lg font-semibold">{c.title}</p>
      <p className="text-sm text-muted-foreground mt-1">{c.note}</p>
    </div>
  );
}

function JobStatusBadge({ status }: { status: JobStatus }) {
  const cls: Record<JobStatus, string> = {
    beklemede:
      "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30",
    uretimde:
      "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    tamamlandi:
      "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
    iptal: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
  };
  return (
    <Badge variant="outline" className={cn("border font-medium", cls[status])}>
      {JOB_STATUS_LABEL[status]}
    </Badge>
  );
}

function formatTime(t: string | null): string {
  if (!t) return "—";
  return t.slice(0, 5);
}
