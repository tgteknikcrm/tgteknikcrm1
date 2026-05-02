"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  Calendar,
  ClipboardCheck,
  ClipboardList,
  Cog,
  Hash,
  Package,
  Pause,
  Sparkles,
  TrendingUp,
  User as UserIcon,
  Wrench as WrenchIcon,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import {
  formatMinutes,
  JOB_STATUS_LABEL,
  MACHINE_STATUS_LABEL,
  type JobStatus,
  type MachineStatus,
} from "@/lib/supabase/types";
import { LiveTelemetry } from "./live-telemetry";

/* ── Types echoed from the server page ────────────────────────────── */

export type TabKey =
  | "profil"
  | "istatistik"
  | "uretim"
  | "duruslar"
  | "bakim"
  | "ariza"
  | "temizlik";

export interface CurrentJobInfo {
  id: string;
  job_no: string | null;
  customer: string;
  part_name: string;
  part_no: string | null;
  quantity: number;
  due_date: string | null;
  produced_total: number;
  operator_name: string | null;
  shift_label: string | null;
  start_time: string | null;
  end_time: string | null;
  today_produced: number;
  today_scrap: number;
  today_downtime: number;
}

export interface MachineToolRow {
  name: string;
  code: string | null;
  size: string | null;
  quantity_used: number;
}

export interface ProducedProductRow {
  product_id: string | null;
  product_code: string | null;
  product_name: string | null;
  job_count: number;
  total_produced: number;
  total_scrap: number;
  last_seen: string | null;
}

export interface DowntimeRow {
  id: string;
  status: MachineStatus;
  started_at: string;
  ended_at: string | null;
  elapsed_minutes: number;
  job_part_name: string | null;
  notes: string | null;
}

export interface TimelineEntryRow {
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
}

export interface ProductionEntryRow {
  id: string;
  entry_date: string;
  shift: string;
  start_time: string | null;
  end_time: string | null;
  produced_qty: number;
  scrap_qty: number;
  setup_minutes: number;
  downtime_minutes: number;
  operator_name: string | null;
  job_part_name: string | null;
  job_status: JobStatus | null;
}

export interface KpiData {
  todayTotal: number;
  todayScrap: number;
  todayDown: number;
  weekTotal: number;
  weekScrap: number;
  weekDown: number;
  scrapPct: number;
  uptimePct: number;
}

interface Props {
  machineId: string;
  machineStatus: MachineStatus;
  currentJob: CurrentJobInfo | null;
  toolHints: Array<{ name: string; code: string | null; size: string | null }>;
  tools: MachineToolRow[];
  products: ProducedProductRow[];
  downtimes: DowntimeRow[];
  bakimEntries: TimelineEntryRow[];
  arizaEntries: TimelineEntryRow[];
  temizlikEntries: TimelineEntryRow[];
  productionLog: ProductionEntryRow[];
  kpis: KpiData;
}

/* ── Tab definitions (icon + Turkish label) ───────────────────────── */

const TABS: Array<{ key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: "profil", label: "Profil", icon: Cog },
  { key: "istatistik", label: "İstatistik", icon: TrendingUp },
  { key: "uretim", label: "Üretim", icon: Package },
  { key: "duruslar", label: "Duruşlar", icon: Pause },
  { key: "bakim", label: "Bakım", icon: WrenchIcon },
  { key: "ariza", label: "Arıza", icon: AlertOctagon },
  { key: "temizlik", label: "Temizlik", icon: Sparkles },
];

const STATUS_TONE: Record<MachineStatus, string> = {
  aktif: "text-emerald-700 dark:text-emerald-300 bg-emerald-500/10",
  durus: "text-zinc-700 dark:text-zinc-300 bg-zinc-500/10",
  bakim: "text-amber-700 dark:text-amber-300 bg-amber-500/10",
  ariza: "text-rose-700 dark:text-rose-300 bg-rose-500/10",
};

export function MachineTabs(props: Props) {
  const [tab, setTab] = useState<TabKey>("profil");

  return (
    <>
      {/* Horizontal tab nav with underline indicator */}
      <div className="border-b mb-4 -mx-1 overflow-x-auto">
        <div className="flex items-center gap-1 px-1 min-w-max">
          {TABS.map((t) => {
            const active = tab === t.key;
            const count = countForTab(t.key, props);
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  "relative flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition whitespace-nowrap",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-t",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                )}
              >
                <t.icon className="size-4" />
                <span>{t.label}</span>
                {count != null && count > 0 && (
                  <span
                    className={cn(
                      "h-4 min-w-4 px-1 rounded-full text-[10px] font-bold tabular-nums flex items-center justify-center",
                      active
                        ? "bg-primary/15 text-primary"
                        : "bg-muted-foreground/15",
                    )}
                  >
                    {count}
                  </span>
                )}
                {/* Underline indicator */}
                <span
                  className={cn(
                    "absolute left-0 right-0 -bottom-px h-0.5 transition-all",
                    active ? "bg-primary" : "bg-transparent",
                  )}
                  aria-hidden
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      {tab === "profil" && (
        <ProfilTab
          machineId={props.machineId}
          machineStatus={props.machineStatus}
          currentJob={props.currentJob}
          toolHints={props.toolHints}
          tools={props.tools}
          kpis={props.kpis}
        />
      )}
      {tab === "istatistik" && <IstatistikTab kpis={props.kpis} />}
      {tab === "uretim" && <UretimTab products={props.products} />}
      {tab === "duruslar" && <DuruslarTab rows={props.downtimes} />}
      {tab === "bakim" && (
        <TimelineList rows={props.bakimEntries} emptyText="Bakım kaydı yok" />
      )}
      {tab === "ariza" && (
        <TimelineList rows={props.arizaEntries} emptyText="Arıza kaydı yok" />
      )}
      {tab === "temizlik" && (
        <TimelineList rows={props.temizlikEntries} emptyText="Temizlik kaydı yok" />
      )}
    </>
  );
}

function countForTab(k: TabKey, p: Props): number | null {
  switch (k) {
    case "uretim":
      return p.products.length;
    case "duruslar":
      return p.downtimes.length;
    case "bakim":
      return p.bakimEntries.length;
    case "ariza":
      return p.arizaEntries.length;
    case "temizlik":
      return p.temizlikEntries.length;
    default:
      return null;
  }
}

/* ── PROFIL: current job hero + tools + live telemetry ─────────────── */

function ProfilTab({
  machineId,
  machineStatus,
  currentJob,
  toolHints,
  tools,
  kpis,
}: {
  machineId: string;
  machineStatus: MachineStatus;
  currentJob: CurrentJobInfo | null;
  toolHints: Array<{ name: string; code: string | null; size: string | null }>;
  tools: MachineToolRow[];
  kpis: KpiData;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LiveTelemetry
          machineId={machineId}
          status={machineStatus}
          toolHints={toolHints}
        />
        <div className="grid grid-cols-2 gap-3 content-start">
          <KpiTile
            icon={TrendingUp}
            label="Bugün"
            value={kpis.todayTotal}
            unit="adet"
            tone="emerald"
          />
          <KpiTile
            icon={AlertTriangle}
            label="Bugün Fire"
            value={kpis.todayScrap}
            unit="adet"
            tone={kpis.todayScrap > 0 ? "amber" : "zinc"}
          />
          <KpiTile
            icon={Pause}
            label="Bugün Duruş"
            value={kpis.todayDown}
            unit="dk"
            tone={kpis.todayDown > 60 ? "rose" : "zinc"}
          />
          <KpiTile
            icon={Cog}
            label="7g Verim"
            value={`%${kpis.uptimePct.toFixed(0)}`}
            unit=""
            tone={kpis.uptimePct < 80 ? "amber" : "emerald"}
          />
        </div>
      </div>

      {/* Current job hero */}
      <Card className="overflow-hidden gap-0 py-0">
        <div
          className={cn(
            "h-1.5 w-full",
            currentJob ? "bg-emerald-500" : "bg-muted",
          )}
        />
        <CardContent className="p-5">
          {currentJob ? (
            <CurrentJobHero job={currentJob} />
          ) : (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <Cog className="size-8 mx-auto opacity-30 mb-2" />
              Şu an üretimde iş yok.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active job tools */}
      <Card>
        <CardContent className="p-4">
          <div className="text-sm font-semibold mb-3 flex items-center gap-2">
            <WrenchIcon className="size-4 text-muted-foreground" />
            Aktif İş Takımları
            {tools.length > 0 && (
              <Badge variant="outline" className="ml-auto font-normal">
                {tools.length}
              </Badge>
            )}
          </div>
          {tools.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center italic">
              {currentJob ? "Bu iş için takım atanmamış." : "Aktif iş yok."}
            </div>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {tools.map((t, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-2 p-2 rounded-md hover:bg-muted/50 transition border"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">{t.name}</div>
                    <div className="text-xs text-muted-foreground truncate font-mono">
                      {t.code ?? ""}
                      {t.size ? ` · ${t.size}` : ""}
                    </div>
                  </div>
                  <Badge variant="outline" className="tabular-nums shrink-0">
                    {t.quantity_used}x
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CurrentJobHero({ job }: { job: CurrentJobInfo }) {
  const pct =
    job.quantity > 0 ? Math.round((job.produced_total / job.quantity) * 100) : 0;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 space-y-4">
        <div>
          <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Şu An Üretiliyor
          </div>
          <h2 className="text-2xl font-bold tracking-tight">{job.part_name}</h2>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground mt-1">
            <span className="inline-flex items-center gap-1 font-mono text-xs">
              <Hash className="size-3.5" /> {job.job_no || "—"}
            </span>
            <span className="font-medium text-foreground/80">
              {job.customer}
            </span>
            {job.part_no && (
              <span className="font-mono text-xs">P/N: {job.part_no}</span>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">
              İlerleme
            </span>
            <span className="text-sm font-bold tabular-nums">%{pct}</span>
          </div>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-4xl font-bold font-mono tabular-nums leading-none">
              {job.produced_total}
            </span>
            <span className="text-lg text-muted-foreground tabular-nums">
              / {job.quantity}
            </span>
            <span className="text-sm text-muted-foreground ml-1">adet</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
          {job.due_date && (
            <p className="text-xs text-muted-foreground mt-2 inline-flex items-center gap-1.5">
              <Calendar className="size-3" /> Teslim: {formatDate(job.due_date)}
            </p>
          )}
        </div>

        <Button asChild size="sm" variant="outline" className="gap-1">
          <Link href={`/quality/${job.id}`}>
            <ClipboardCheck className="size-3.5" />
            Kalite Kontrol
            <ArrowRight className="size-3" />
          </Link>
        </Button>
      </div>

      <div className="space-y-3 lg:border-l lg:pl-5">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Operatör
          </div>
          <div className="flex items-center gap-2 mt-1">
            <UserIcon className="size-4 text-muted-foreground" />
            <span className="font-semibold text-sm">
              {job.operator_name || "—"}
            </span>
          </div>
          {job.shift_label && (
            <div className="text-xs text-muted-foreground mt-0.5">
              {job.shift_label} vardiyası
            </div>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 pt-3 border-t">
          <MiniStat label="Bugün" value={job.today_produced} />
          <MiniStat label="Fire" value={job.today_scrap} tone="amber" />
          <MiniStat label="Duruş" value={`${job.today_downtime} dk`} tone="muted" />
        </div>
      </div>
    </div>
  );
}

/* ── İSTATİSTİK ─────────────────────────────────────────────────── */

function IstatistikTab({ kpis }: { kpis: KpiData }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <KpiTile
        icon={TrendingUp}
        label="Bugün Üretilen"
        value={kpis.todayTotal}
        unit="adet"
        tone="emerald"
      />
      <KpiTile
        icon={Package}
        label="7 Gün Toplam"
        value={kpis.weekTotal}
        unit="adet"
        tone="blue"
        sub={`fire ${kpis.weekScrap}`}
      />
      <KpiTile
        icon={AlertTriangle}
        label="Fire Oranı (7g)"
        value={`%${kpis.scrapPct.toFixed(1)}`}
        unit=""
        tone={kpis.scrapPct > 5 ? "rose" : "amber"}
      />
      <KpiTile
        icon={Cog}
        label="Çalışma Verimi (7g)"
        value={`%${kpis.uptimePct.toFixed(0)}`}
        unit=""
        tone={kpis.uptimePct < 80 ? "amber" : "emerald"}
        sub={`duruş ${kpis.weekDown}dk`}
      />
    </div>
  );
}

/* ── ÜRETİM (which products were produced on this machine) ───────── */

function UretimTab({ products }: { products: ProducedProductRow[] }) {
  if (products.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          <Package className="size-10 mx-auto opacity-30 mb-3" />
          Bu makinede henüz üretim kaydı yok.
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="p-0">
        <ul className="divide-y">
          {products.map((p, i) => (
            <li
              key={p.product_id ?? i}
              className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/30 transition"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  {p.product_code && (
                    <span className="font-mono text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                      {p.product_code}
                    </span>
                  )}
                  <span className="font-semibold text-sm truncate">
                    {p.product_name ?? "—"}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-x-3 flex-wrap">
                  <span>{p.job_count} iş</span>
                  {p.last_seen && (
                    <span>· son: {formatDate(p.last_seen)}</span>
                  )}
                </div>
              </div>
              <div className="text-right tabular-nums shrink-0">
                <div className="text-base font-bold">
                  {p.total_produced.toLocaleString("tr-TR")}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  adet üretildi
                  {p.total_scrap > 0 && (
                    <span className="ml-1 text-amber-700 dark:text-amber-300">
                      · {p.total_scrap} fire
                    </span>
                  )}
                </div>
              </div>
              {p.product_id && (
                <Button asChild size="icon" variant="ghost" className="size-7">
                  <Link href={`/products/${p.product_id}`}>
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/* ── DURUŞLAR (auto-tracked downtime sessions, all statuses) ───────── */

function DuruslarTab({ rows }: { rows: DowntimeRow[] }) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          <Pause className="size-10 mx-auto opacity-30 mb-3" />
          Bu makinede kayıtlı duruş yok.
        </CardContent>
      </Card>
    );
  }
  // Aggregate per status for the summary strip
  const summary = rows.reduce(
    (acc, r) => {
      acc[r.status].count += 1;
      acc[r.status].minutes += r.elapsed_minutes;
      return acc;
    },
    {
      durus: { count: 0, minutes: 0 },
      bakim: { count: 0, minutes: 0 },
      ariza: { count: 0, minutes: 0 },
      aktif: { count: 0, minutes: 0 },
    } as Record<MachineStatus, { count: number; minutes: number }>,
  );
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <DowntimeSummaryTile
          label="Duruş"
          icon={Pause}
          tone="zinc"
          count={summary.durus.count}
          minutes={summary.durus.minutes}
        />
        <DowntimeSummaryTile
          label="Bakım"
          icon={WrenchIcon}
          tone="amber"
          count={summary.bakim.count}
          minutes={summary.bakim.minutes}
        />
        <DowntimeSummaryTile
          label="Arıza"
          icon={AlertOctagon}
          tone="rose"
          count={summary.ariza.count}
          minutes={summary.ariza.minutes}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <ul className="divide-y">
            {rows.map((r) => (
              <li key={r.id} className="px-4 py-3">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider",
                      STATUS_TONE[r.status],
                    )}
                  >
                    {MACHINE_STATUS_LABEL[r.status]}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {new Date(r.started_at).toLocaleString("tr-TR", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {r.ended_at && (
                      <>
                        {" → "}
                        {new Date(r.ended_at).toLocaleString("tr-TR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </>
                    )}
                  </span>
                  <span className="ml-auto text-sm font-bold tabular-nums">
                    {formatMinutes(r.elapsed_minutes)}
                  </span>
                </div>
                {(r.job_part_name || r.notes) && (
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {r.job_part_name && (
                      <div>
                        <span className="font-semibold text-foreground/70">
                          İş:
                        </span>{" "}
                        {r.job_part_name}
                      </div>
                    )}
                    {r.notes && (
                      <div>
                        <span className="font-semibold text-foreground/70">
                          Sebep:
                        </span>{" "}
                        {r.notes}
                      </div>
                    )}
                  </div>
                )}
                {!r.ended_at && (
                  <Badge
                    variant="outline"
                    className="mt-1 text-[10px] gap-1 border-rose-500/40 text-rose-700 dark:text-rose-300"
                  >
                    <span className="size-1.5 rounded-full bg-rose-500 animate-pulse" />
                    Devam ediyor
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function DowntimeSummaryTile({
  label,
  icon: Icon,
  tone,
  count,
  minutes,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "zinc" | "amber" | "rose";
  count: number;
  minutes: number;
}) {
  const tones: Record<string, string> = {
    zinc: "border-zinc-500/30 bg-zinc-500/5 text-zinc-700 dark:text-zinc-300",
    amber:
      "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300",
    rose: "border-rose-500/30 bg-rose-500/5 text-rose-700 dark:text-rose-300",
  };
  return (
    <div className={cn("rounded-lg border p-3", tones[tone])}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="size-4" />
        <span className="text-xs font-bold uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="text-lg font-bold tabular-nums leading-tight">
        {count} kez
      </div>
      <div className="text-xs opacity-80">{formatMinutes(minutes)}</div>
    </div>
  );
}

/* ── BAKIM/ARIZA/TEMİZLİK (manual timeline entries) ───────────────── */

function TimelineList({
  rows,
  emptyText,
}: {
  rows: TimelineEntryRow[];
  emptyText: string;
}) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          <ClipboardList className="size-10 mx-auto opacity-30 mb-3" />
          {emptyText}
          <p className="text-[11px] mt-2 opacity-70">
            Kayıt eklemek için makine kartından "Olay Ekle"yi kullan.
          </p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="p-0">
        <ul className="divide-y">
          {rows.map((r) => (
            <li key={r.id} className="px-4 py-3">
              <div className="flex items-baseline gap-2 flex-wrap mb-0.5">
                <span className="font-semibold text-sm">
                  {r.title ?? "(Başlık yok)"}
                </span>
                {r.duration_minutes != null && r.duration_minutes > 0 && (
                  <span className="text-xs font-mono text-muted-foreground">
                    · {formatMinutes(r.duration_minutes)}
                  </span>
                )}
                {r.entry_status && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] h-5",
                      r.entry_status === "cozuldu"
                        ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                        : r.entry_status === "devam"
                          ? "border-amber-500/40 text-amber-700 dark:text-amber-300"
                          : "border-rose-500/40 text-rose-700 dark:text-rose-300",
                    )}
                  >
                    {r.entry_status === "cozuldu"
                      ? "Çözüldü"
                      : r.entry_status === "devam"
                        ? "Devam"
                        : "Açık"}
                  </Badge>
                )}
                <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
                  {new Date(r.happened_at).toLocaleString("tr-TR", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              {r.body && (
                <p className="text-xs text-muted-foreground whitespace-pre-wrap mb-1">
                  {r.body}
                </p>
              )}
              {r.fix_description && (
                <div className="text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 rounded px-2 py-1 mt-1">
                  <span className="font-semibold">Çözüm:</span>{" "}
                  {r.fix_description}
                </div>
              )}
              {r.author_name && (
                <div className="text-[10px] text-muted-foreground mt-1">
                  — {r.author_name}
                </div>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/* ── Reusable bits ──────────────────────────────────────────────── */

function KpiTile({
  icon: Icon,
  label,
  value,
  unit,
  tone,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  unit: string;
  tone: "emerald" | "blue" | "amber" | "rose" | "zinc";
  sub?: string;
}) {
  const tones: Record<string, string> = {
    emerald: "border-emerald-500/30 bg-emerald-500/5",
    blue: "border-blue-500/30 bg-blue-500/5",
    amber: "border-amber-500/30 bg-amber-500/5",
    rose: "border-rose-500/30 bg-rose-500/5",
    zinc: "border-border bg-muted/30",
  };
  return (
    <div className={cn("rounded-lg border p-3", tones[tone])}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="text-2xl font-bold tabular-nums leading-tight mt-1">
        {typeof value === "number" ? value.toLocaleString("tr-TR") : value}
        {unit && (
          <span className="text-xs ml-1 text-muted-foreground font-normal">
            {unit}
          </span>
        )}
      </div>
      {sub && (
        <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>
      )}
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
  tone?: "amber" | "muted";
}) {
  const cls =
    tone === "amber"
      ? "text-amber-700 dark:text-amber-300"
      : tone === "muted"
        ? "text-muted-foreground"
        : "text-foreground";
  return (
    <div className="text-center">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">
        {label}
      </div>
      <div className={cn("text-sm font-bold tabular-nums", cls)}>{value}</div>
    </div>
  );
}

// Suppress unused (kept for potential future tabs)
void JOB_STATUS_LABEL;
