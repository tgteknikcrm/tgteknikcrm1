import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  type Shift,
  type JobStatus,
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
} from "lucide-react";
import { MachineDialog } from "../machine-dialog";
import { ShiftAssignments } from "../shift-assignments";
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

  const [entriesRes, weekRes, todayStatsRes, jobsRes, assignmentsRes, operatorsRes] = await Promise.all([
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
    supabase
      .from("machine_shift_assignments")
      .select(`*, operator:operators(id, full_name, employee_no, phone)`)
      .eq("machine_id", id),
    supabase
      .from("operators")
      .select("id, full_name, employee_no, phone, shift, active")
      .eq("active", true)
      .order("full_name"),
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
  const assignments = (assignmentsRes.data ?? []) as Array<{
    id: string;
    machine_id: string;
    shift: Shift;
    operator_id: string;
    notes: string | null;
    assigned_by: string | null;
    created_at: string;
    updated_at: string;
    operator: {
      id: string;
      full_name: string;
      employee_no: string | null;
      phone: string | null;
    } | null;
  }>;
  const operators = (operatorsRes.data ?? []) as Array<{
    id: string;
    full_name: string;
    employee_no: string | null;
    phone: string | null;
    shift: Shift | null;
    active: boolean;
  }>;

  // Current active production — most recent entry today with a linked job
  const currentEntry = entries.find(
    (e) => e.entry_date === today && e.jobs && e.jobs.status === "uretimde",
  ) ?? entries.find((e) => e.entry_date === today && e.jobs);
  const currentJob = currentEntry?.jobs ?? null;

  // Aggregate total produced for the current job across all entries
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

  // Tools used on the current job
  let currentJobTools: JobToolRow[] = [];
  if (currentJob) {
    const toolsRes = await supabase
      .from("job_tools")
      .select(`quantity_used, tool:tools(id, code, name, type, size)`)
      .eq("job_id", currentJob.id);
    currentJobTools = (toolsRes.data ?? []) as unknown as JobToolRow[];
  }

  const todayTotal = todayEntries.reduce((s, e) => s + (e.produced_qty ?? 0), 0);
  const todayScrap = todayEntries.reduce((s, e) => s + (e.scrap_qty ?? 0), 0);
  const todayDown = todayEntries.reduce((s, e) => s + (e.downtime_minutes ?? 0), 0);

  const weekTotal = weekEntries.reduce((s, e) => s + (e.produced_qty ?? 0), 0);
  const weekScrap = weekEntries.reduce((s, e) => s + (e.scrap_qty ?? 0), 0);
  const weekDown = weekEntries.reduce((s, e) => s + (e.downtime_minutes ?? 0), 0);

  const scrapPct =
    weekTotal + weekScrap > 0
      ? (weekScrap / (weekTotal + weekScrap)) * 100
      : 0;

  // Uptime: assume 8 shift hours/day (480 min); uptime = 1 - downtime/total
  const shiftMinutes = weekEntries.length * 480;
  const uptimePct =
    shiftMinutes > 0 ? Math.max(0, 1 - weekDown / shiftMinutes) * 100 : 100;

  // Build 7-day daily series
  const weekByDate = new Map<string, number>();
  for (const e of weekEntries) {
    weekByDate.set(e.entry_date, (weekByDate.get(e.entry_date) ?? 0) + (e.produced_qty ?? 0));
  }
  const days: { date: string; label: string; qty: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 864e5);
    const iso = d.toISOString().slice(0, 10);
    days.push({
      date: iso,
      label: d.toLocaleDateString("tr-TR", { weekday: "short", day: "numeric" }),
      qty: weekByDate.get(iso) ?? 0,
    });
  }
  const maxQty = Math.max(1, ...days.map((d) => d.qty));

  const tone = MACHINE_STATUS_TONE[machine.status];

  return (
    <>
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/machines">
            <ArrowLeft className="size-4" /> Tüm Makineler
          </Link>
        </Button>
      </div>

      {/* Hero */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "size-14 rounded-2xl flex items-center justify-center border",
              tone.badge,
            )}
          >
            <Factory className="size-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
              {machine.name}
              <Badge
                variant="outline"
                className={cn("border gap-1.5 font-medium", tone.badge)}
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
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {machine.type}
              {machine.model ? ` · ${machine.model}` : ""}
              {machine.serial_no ? ` · S/N ${machine.serial_no}` : ""}
            </p>
          </div>
        </div>
        <MachineDialog
          machine={machine}
          trigger={<Button variant="outline">Düzenle</Button>}
        />
      </div>

      {/* Current production card */}
      <Card
        className={cn(
          "mb-6 overflow-hidden gap-0 py-0",
          "bg-gradient-to-br from-card to-muted/20",
        )}
      >
        <div className={cn("h-1 w-full", tone.dot)} />
        <CardContent className="p-6">
          {currentJob ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <div>
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <Activity className="size-3" /> Şu An Üretiliyor
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight">
                    {currentJob.part_name}
                  </h2>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
                    <span className="flex items-center gap-1">
                      <Hash className="size-3.5" /> {currentJob.job_no || "—"}
                    </span>
                    <span>{currentJob.customer}</span>
                    {currentJob.part_no && (
                      <span className="font-mono">P/N: {currentJob.part_no}</span>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-xs text-muted-foreground">İlerleme</span>
                    <span className="text-sm font-bold tabular-nums">
                      %
                      {currentJob.quantity > 0
                        ? Math.round((currentJobTotal / currentJob.quantity) * 100)
                        : 0}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-4xl font-bold font-mono tabular-nums">
                      {currentJobTotal}
                    </span>
                    <span className="text-lg text-muted-foreground tabular-nums">
                      / {currentJob.quantity}
                    </span>
                    <span className="text-sm text-muted-foreground ml-1">adet</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        tone.dot,
                      )}
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
                    <p className="text-xs text-muted-foreground mt-2">
                      Teslim: {formatDate(currentJob.due_date)}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-3 lg:border-l lg:pl-6">
                <InfoLine
                  icon={UserIcon}
                  label="Operatör"
                  value={currentEntry?.operators?.full_name || "—"}
                  sub={
                    currentEntry?.shift
                      ? `${SHIFT_LABEL[currentEntry.shift as Shift]} vardiyası`
                      : undefined
                  }
                />
                <InfoLine
                  icon={Clock}
                  label="Başlama / Bitiş"
                  value={`${formatTime(currentEntry?.start_time ?? null)} → ${formatTime(
                    currentEntry?.end_time ?? null,
                  )}`}
                />
                <div className="grid grid-cols-3 gap-3 pt-3 border-t">
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

      {/* Shift assignments */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <UserIcon className="size-4" /> Vardiya Operatör Atamaları
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ShiftAssignments
            machineId={machine.id}
            assignments={assignments}
            operators={operators}
          />
        </CardContent>
      </Card>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Kpi icon={TrendingUp} label="Bugün Üretilen" value={todayTotal} hint="adet" />
        <Kpi
          icon={Target}
          label="7 Günlük Toplam"
          value={weekTotal}
          hint={`fire: ${weekScrap}`}
        />
        <Kpi
          icon={AlertTriangle}
          label="Fire Oranı (7g)"
          value={`%${scrapPct.toFixed(1)}`}
          tone={scrapPct > 5 ? "warn" : "default"}
          hint="üretim + fire oranı"
        />
        <Kpi
          icon={Percent}
          label="Çalışma Verimi (7g)"
          value={`%${uptimePct.toFixed(0)}`}
          tone={uptimePct < 80 ? "warn" : "default"}
          hint={`duruş: ${weekDown} dk`}
        />
      </div>

      {/* Week trend + Tools + Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="size-4" /> Son 7 Gün Üretim
            </CardTitle>
          </CardHeader>
          <CardContent>
            {weekTotal === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Son 7 günde üretim kaydı yok.
              </p>
            ) : (
              <div className="flex items-end gap-2 h-40">
                {days.map((d) => {
                  const h = Math.max(4, (d.qty / maxQty) * 140);
                  const today = d.date === new Date().toISOString().slice(0, 10);
                  return (
                    <div
                      key={d.date}
                      className="flex-1 flex flex-col items-center gap-1"
                    >
                      <span className="text-[10px] tabular-nums text-muted-foreground">
                        {d.qty || "—"}
                      </span>
                      <div
                        className={cn(
                          "w-full rounded-md transition-all",
                          today ? tone.dot : "bg-muted-foreground/30",
                        )}
                        style={{ height: `${h}px` }}
                        title={`${d.label}: ${d.qty}`}
                      />
                      <span
                        className={cn(
                          "text-[10px] mt-1",
                          today
                            ? "font-semibold text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        {d.label}
                      </span>
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
              <WrenchIcon className="size-4" /> Kullanılan Takımlar
            </CardTitle>
          </CardHeader>
          <CardContent>
            {currentJob ? (
              currentJobTools.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Bu iş için takım atanmamış.
                </p>
              ) : (
                <ul className="space-y-2">
                  {currentJobTools.map((jt, i) => (
                    <li
                      key={jt.tool?.id ?? i}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate">
                          {jt.tool?.name ?? "—"}
                        </div>
                        <div className="text-xs text-muted-foreground truncate font-mono">
                          {jt.tool?.code ?? ""}
                          {jt.tool?.size ? ` · ${jt.tool.size}` : ""}
                        </div>
                      </div>
                      <Badge variant="outline" className="tabular-nums">
                        {jt.quantity_used}x
                      </Badge>
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <p className="text-sm text-muted-foreground">
                Aktif iş yok.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Machine info + Job history */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Makine Bilgileri</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Field label="Seri No" value={machine.serial_no} icon={Hash} />
            <Field label="Konum" value={machine.location} icon={MapPin} />
            <Field
              label="Son Güncelleme"
              value={new Date(machine.updated_at).toLocaleDateString("tr-TR")}
              icon={Calendar}
            />
            {machine.notes && (
              <div className="pt-2 border-t">
                <div className="text-xs text-muted-foreground mb-1">Notlar</div>
                <p className="text-sm whitespace-pre-wrap">{machine.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="size-4" /> İş Geçmişi ({jobs.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {jobs.length === 0 ? (
              <p className="text-sm text-muted-foreground p-6 text-center">
                Bu makineye iş atanmamış.
              </p>
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
                    <TableRow key={j.id}>
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
                      <TableCell className="text-right tabular-nums">
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
      </div>

      {/* Recent production entries */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Son 30 Üretim Kaydı</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {entries.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Bu makine için henüz üretim kaydı girilmemiş.
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
                  <TableRow key={e.id}>
                    <TableCell className="text-sm">
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
                    <TableCell className="text-right font-mono tabular-nums">
                      {e.produced_qty}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-amber-600">
                      {e.scrap_qty}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {e.downtime_minutes}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function InfoLine({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Factory;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="size-8 rounded-md bg-muted/60 flex items-center justify-center shrink-0">
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          {label}
        </div>
        <div className="text-sm font-semibold leading-tight truncate">{value}</div>
        {sub && (
          <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
        )}
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
      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
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

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: typeof Factory;
  label: string;
  value: number | string;
  hint?: string;
  tone?: "default" | "warn";
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {label}
            </div>
            <div
              className={cn(
                "text-2xl font-semibold mt-1 tabular-nums",
                tone === "warn" && "text-amber-600",
              )}
            >
              {value}
            </div>
            {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
          </div>
          <Icon
            className={cn(
              "size-5",
              tone === "warn" ? "text-amber-600" : "text-muted-foreground",
            )}
          />
        </div>
      </CardContent>
    </Card>
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
      <Icon className="size-4 text-muted-foreground" />
      <div className="min-w-0">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          {label}
        </div>
        <div className="text-sm truncate">{value || "—"}</div>
      </div>
    </div>
  );
}

function EmptyCurrentJob({ status }: { status: Machine["status"] }) {
  const msg =
    status === "ariza"
      ? { title: "Arızalı", note: "Bu makine şu an üretim yapmıyor." }
      : status === "bakim"
      ? { title: "Bakımda", note: "Planlı bakım nedeniyle üretim duruyor." }
      : status === "durus"
      ? { title: "Duruşta", note: "Üretim durduruldu." }
      : { title: "Boşta", note: "Bugün için atanmış iş yok." };
  return (
    <div className="py-6 text-center">
      <Activity className="size-8 mx-auto text-muted-foreground/50 mb-2" />
      <p className="text-base font-semibold">{msg.title}</p>
      <p className="text-sm text-muted-foreground mt-1">{msg.note}</p>
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
