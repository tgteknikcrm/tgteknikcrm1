import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/app/page-header";
import { createClient } from "@/lib/supabase/server";
import {
  Factory,
  ClipboardList,
  Wrench,
  Users,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { SHIFT_LABEL } from "@/lib/supabase/types";
import type { Machine, ProductionEntry } from "@/lib/supabase/types";
import { formatDate } from "@/lib/utils";
import { MachinesGrid, type MachineCardData } from "./machines-grid";

export const metadata = { title: "Dashboard" };

type EntryRow = {
  machine_id: string;
  job_id: string | null;
  start_time: string | null;
  end_time: string | null;
  job: {
    id: string;
    job_no: string | null;
    part_name: string;
    quantity: number;
    customer: string;
  } | null;
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

    const entries = (todayEntriesRes.data ?? []) as unknown as EntryRow[];
    const latestByMachine = new Map<string, EntryRow>();
    for (const e of entries) {
      if (!latestByMachine.has(e.machine_id) && e.job) {
        latestByMachine.set(e.machine_id, e);
      }
    }

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

    const machineCards: MachineCardData[] = machines.map((m) => {
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
      machineCards: [] as MachineCardData[],
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

      <MachinesGrid cards={data.machineCards} />

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
