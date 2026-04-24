import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/page-header";
import { createClient } from "@/lib/supabase/server";
import {
  Factory,
  ClipboardList,
  Wrench,
  Users,
  TrendingUp,
  AlertCircle,
  Clock,
  AlertTriangle,
  PauseCircle,
  Coffee,
} from "lucide-react";
import {
  MACHINE_STATUS_LABEL,
  MACHINE_STATUS_TONE,
  SHIFT_LABEL,
} from "@/lib/supabase/types";
import type { Machine, ProductionEntry } from "@/lib/supabase/types";
import { formatDate, cn } from "@/lib/utils";
import Link from "next/link";

export const metadata = { title: "Dashboard" };

type MachineCard = {
  machine: Machine;
  job: { id: string; job_no: string | null; part_name: string; quantity: number; customer: string } | null;
  totalProduced: number;
  operatorName: string | null;
  startTime: string | null;
  endTime: string | null;
};

type EntryRow = {
  machine_id: string;
  job_id: string | null;
  start_time: string | null;
  end_time: string | null;
  job: { id: string; job_no: string | null; part_name: string; quantity: number; customer: string } | null;
  operator: { full_name: string } | null;
};

async function getDashboardData() {
  try {
    const supabase = await createClient();

    const today = new Date().toISOString().slice(0, 10);

    const [machinesRes, todayRes, openJobsRes, toolsLowRes, operatorsRes, todayEntriesRes] =
      await Promise.all([
        supabase.from("machines").select("*").order("name"),
        supabase
          .from("production_entries")
          .select("produced_qty, scrap_qty, downtime_minutes")
          .eq("entry_date", today),
        supabase
          .from("jobs")
          .select("id", { count: "exact", head: true })
          .in("status", ["beklemede", "uretimde"]),
        supabase
          .from("tools")
          .select("id, name, quantity, min_quantity")
          .order("quantity"),
        supabase.from("operators").select("id", { count: "exact", head: true }).eq("active", true),
        supabase
          .from("production_entries")
          .select(
            `machine_id, job_id, start_time, end_time,
             job:jobs(id, job_no, part_name, quantity, customer),
             operator:operators(full_name)`,
          )
          .eq("entry_date", today)
          .order("created_at", { ascending: false }),
      ]);

    const machines: Machine[] = machinesRes.data ?? [];
    const todayEntries = (todayRes.data ?? []) as Pick<
      ProductionEntry,
      "produced_qty" | "scrap_qty" | "downtime_minutes"
    >[];
    const todayProduced = todayEntries.reduce((s, e) => s + (e.produced_qty ?? 0), 0);
    const todayScrap = todayEntries.reduce((s, e) => s + (e.scrap_qty ?? 0), 0);
    const todayDowntime = todayEntries.reduce((s, e) => s + (e.downtime_minutes ?? 0), 0);

    // Latest entry per machine (with a job attached) — drives the machine cards
    const entries = (todayEntriesRes.data ?? []) as unknown as EntryRow[];
    const latestByMachine = new Map<string, EntryRow>();
    for (const e of entries) {
      if (!latestByMachine.has(e.machine_id) && e.job) {
        latestByMachine.set(e.machine_id, e);
      }
    }

    // Total produced per active job (across all dates)
    const activeJobIds = Array.from(latestByMachine.values())
      .map((e) => e.job_id)
      .filter((v): v is string => Boolean(v));
    const totalsByJob = new Map<string, number>();
    if (activeJobIds.length > 0) {
      const { data: allEntries } = await supabase
        .from("production_entries")
        .select("job_id, produced_qty")
        .in("job_id", activeJobIds);
      for (const e of (allEntries ?? []) as { job_id: string | null; produced_qty: number }[]) {
        if (e.job_id) {
          totalsByJob.set(e.job_id, (totalsByJob.get(e.job_id) ?? 0) + (e.produced_qty ?? 0));
        }
      }
    }

    const machineCards: MachineCard[] = machines.map((m) => {
      const e = latestByMachine.get(m.id);
      return {
        machine: m,
        job: e?.job ?? null,
        totalProduced: e?.job ? totalsByJob.get(e.job.id) ?? 0 : 0,
        operatorName: e?.operator?.full_name ?? null,
        startTime: e?.start_time ?? null,
        endTime: e?.end_time ?? null,
      };
    });

    const toolsLow = (toolsLowRes.data ?? []).filter(
      (t) => (t.quantity ?? 0) <= (t.min_quantity ?? 0),
    );

    return {
      machineCards,
      todayProduced,
      todayScrap,
      todayDowntime,
      openJobs: openJobsRes.count ?? 0,
      activeOperators: operatorsRes.count ?? 0,
      toolsLow,
      configured: true,
    };
  } catch {
    return {
      machineCards: [] as MachineCard[],
      todayProduced: 0,
      todayScrap: 0,
      todayDowntime: 0,
      openJobs: 0,
      activeOperators: 0,
      toolsLow: [] as { id: string; name: string; quantity: number; min_quantity: number }[],
      configured: false,
    };
  }
}

export default async function DashboardPage() {
  const data = await getDashboardData();

  if (!data.configured) {
    return (
      <>
        <PageHeader
          title="Dashboard"
          description="Supabase bağlantısı henüz yapılandırılmadı."
        />
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-start gap-3">
              <AlertCircle className="size-5 text-amber-500 mt-0.5" />
              <div className="space-y-2">
                <p className="font-medium">Kurulum gerekli</p>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>
                    <a className="underline" href="https://app.supabase.com" target="_blank" rel="noreferrer">
                      Supabase
                    </a>
                    &apos;de proje aç.
                  </li>
                  <li>
                    Proje URL ve API anahtarlarını{" "}
                    <code className="bg-muted px-1 rounded">.env.local</code>{" "}
                    dosyasına yaz.
                  </li>
                  <li>
                    <code className="bg-muted px-1 rounded">supabase/migrations/0001_init.sql</code>{" "}
                    dosyasının içeriğini Supabase SQL Editor&apos;de çalıştır.
                  </li>
                  <li>
                    <code className="bg-muted px-1 rounded">npm run dev</code>{" "}
                    komutunu yeniden başlat.
                  </li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={formatDate(new Date()) + " · Günlük üretim özeti"}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={TrendingUp}
          label="Bugün Üretilen"
          value={data.todayProduced}
          hint={data.todayScrap > 0 ? `${data.todayScrap} fire` : "fire yok"}
        />
        <StatCard
          icon={ClipboardList}
          label="Açık İşler"
          value={data.openJobs}
          hint="beklemede + üretimde"
        />
        <StatCard icon={Users} label="Aktif Operatör" value={data.activeOperators} />
        <StatCard
          icon={AlertCircle}
          label="Eksik Takım"
          value={data.toolsLow.length}
          hint={data.toolsLow.length ? "stok altında" : "ok"}
          tone={data.toolsLow.length ? "warn" : "default"}
        />
      </div>

      <h2 className="mt-8 mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
        <Factory className="size-4" /> Makineler
      </h2>
      <div className="grid auto-rows-fr grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {data.machineCards.map((c) => (
          <MachineStatusCard key={c.machine.id} card={c} />
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mt-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="size-4" /> Stokta Azalan Takımlar
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.toolsLow.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Tüm takımlar stok seviyesinin üstünde.
              </p>
            ) : (
              <div className="space-y-2">
                {data.toolsLow.slice(0, 8).map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between text-sm p-2 rounded bg-muted/50"
                  >
                    <span className="font-medium">{t.name}</span>
                    <span className="text-amber-600 font-mono">
                      {t.quantity} / min {t.min_quantity}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bugünkü Vardiya Özeti</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-semibold">{data.todayProduced}</div>
                <div className="text-xs text-muted-foreground">Üretim (adet)</div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-amber-600">{data.todayScrap}</div>
                <div className="text-xs text-muted-foreground">Fire / Hurda</div>
              </div>
              <div>
                <div className="text-2xl font-semibold">{data.todayDowntime}</div>
                <div className="text-xs text-muted-foreground">Duruş (dk)</div>
              </div>
            </div>
            <div className="mt-6 text-xs text-muted-foreground text-center">
              Vardiyalar: {Object.values(SHIFT_LABEL).join(" · ")}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function MachineStatusCard({ card }: { card: MachineCard }) {
  const { machine: m, job, totalProduced, operatorName, startTime, endTime } = card;
  const tone = MACHINE_STATUS_TONE[m.status];
  const pct = job && job.quantity > 0 ? Math.min(100, Math.round((totalProduced / job.quantity) * 100)) : 0;
  const initials = operatorName
    ? operatorName.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  return (
    <Link href={`/machines/${m.id}`} className="block h-full group">
      <Card
        className={cn(
          "relative h-full flex flex-col overflow-hidden gap-0 py-0",
          "transition-all duration-200 ease-out",
          "hover:shadow-lg hover:-translate-y-0.5",
          "bg-gradient-to-b from-card to-muted/20",
        )}
      >
        {/* Top accent strip */}
        <div className={cn("h-1 w-full", tone.dot)} />

        <CardHeader className="pt-5 pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <CardTitle className="text-base font-bold tracking-tight truncate">
                {m.name}
              </CardTitle>
              <p className="text-[11px] text-muted-foreground truncate font-mono mt-0.5">
                {m.model || "—"}
              </p>
            </div>
            <Badge
              variant="outline"
              className={cn("border gap-1.5 font-medium", tone.badge)}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  tone.dot,
                  m.status === "aktif" && "animate-pulse",
                )}
              />
              {MACHINE_STATUS_LABEL[m.status]}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col pt-0 pb-5">
          {job ? (
            <div className="flex-1 flex flex-col justify-between gap-4">
              {/* Production progress */}
              <div>
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Üretim
                  </span>
                  <span className="text-xs font-bold tabular-nums text-foreground">
                    %{pct}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold font-mono tabular-nums leading-none">
                    {totalProduced}
                  </span>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    / {job.quantity}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                  <span className="truncate">{job.part_name}</span>
                  {job.job_no && (
                    <span className="opacity-60 font-mono shrink-0">
                      #{job.job_no}
                    </span>
                  )}
                </div>
                <div className="mt-3 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500 ease-out",
                      tone.dot,
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              <div>
                {/* Time row */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="size-7 rounded-md bg-muted/60 flex items-center justify-center shrink-0">
                      <Clock className="size-3.5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Başlama
                      </div>
                      <div className="font-mono font-semibold tabular-nums text-sm leading-tight">
                        {formatTime(startTime)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="size-7 rounded-md bg-muted/60 flex items-center justify-center shrink-0">
                      <Clock className="size-3.5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Bitiş
                      </div>
                      <div className="font-mono font-semibold tabular-nums text-sm leading-tight">
                        {formatTime(endTime)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Operator */}
                <div className="mt-4 pt-4 border-t border-border/60 flex items-center gap-2.5">
                  <div
                    className={cn(
                      "size-8 rounded-full flex items-center justify-center text-[11px] font-bold border shrink-0",
                      tone.badge,
                    )}
                  >
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Operatör
                    </div>
                    <div className="text-sm font-semibold truncate leading-tight">
                      {operatorName || "—"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <EmptyMachineState status={m.status} />
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

function EmptyMachineState({ status }: { status: Machine["status"] }) {
  const tone = MACHINE_STATUS_TONE[status];
  const cfg =
    status === "ariza"
      ? { icon: AlertTriangle, title: "Arızalı", note: "Tezgah devre dışı" }
      : status === "bakim"
      ? { icon: Wrench, title: "Bakımda", note: "Planlı bakım" }
      : status === "durus"
      ? { icon: PauseCircle, title: "Duruşta", note: "Üretim durdu" }
      : { icon: Coffee, title: "Boşta", note: "İş atanmamış" };
  const Icon = cfg.icon;

  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-4">
      <div
        className={cn(
          "size-14 rounded-2xl flex items-center justify-center border",
          tone.badge,
        )}
      >
        <Icon className="size-6" />
      </div>
      <div>
        <p className="text-sm font-semibold">{cfg.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{cfg.note}</p>
      </div>
    </div>
  );
}

function formatTime(t: string | null): string {
  if (!t) return "—";
  // Postgres time comes as "HH:MM:SS" — keep just HH:MM
  return t.slice(0, 5);
}

function StatCard({
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
              className={`text-2xl font-semibold mt-1 ${tone === "warn" ? "text-amber-600" : ""}`}
            >
              {value}
            </div>
            {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
          </div>
          <Icon
            className={`size-5 ${tone === "warn" ? "text-amber-600" : "text-muted-foreground"}`}
          />
        </div>
      </CardContent>
    </Card>
  );
}
