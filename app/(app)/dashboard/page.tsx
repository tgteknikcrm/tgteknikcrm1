import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/app/page-header";
import { createClient } from "@/lib/supabase/server";
import { AlertCircle } from "lucide-react";
import {
  getCurrentShift,
  type Machine,
  type Tool,
} from "@/lib/supabase/types";
import { formatDate } from "@/lib/utils";
import { MachinesGrid, type MachineCardData } from "./machines-grid";
import {
  QualityWidget,
  type QualityWidgetData,
} from "./quality-widget";
import { LowStockWidget } from "./low-stock-widget";
import {
  ShiftSummaryWidget,
  type ShiftSummaryRow,
} from "./shift-summary-widget";

export const metadata = { title: "Dashboard" };

type EntryRow = {
  machine_id: string;
  job_id: string | null;
  start_time: string | null;
  end_time: string | null;
  shift: "sabah" | "aksam" | "gece";
  produced_qty: number;
  scrap_qty: number;
  job: {
    id: string;
    job_no: string | null;
    part_name: string;
    quantity: number;
    customer: string;
  } | null;
  operator: { full_name: string } | null;
  machine: { name: string } | null;
};

async function getDashboardData() {
  try {
    const supabase = await createClient();
    const today = new Date().toISOString().slice(0, 10);
    const currentShift = getCurrentShift();

    const [
      machinesRes,
      todayEntriesRes,
      lowStockRes,
      qcTodayRes,
      qcRecentNokRes,
    ] = await Promise.all([
      supabase.from("machines").select("*").order("name"),
      supabase
        .from("production_entries")
        .select(
          `machine_id, job_id, start_time, end_time, shift, produced_qty, scrap_qty,
           job:jobs(id, job_no, part_name, quantity, customer),
           operator:operators(full_name),
           machine:machines(name)`,
        )
        .eq("entry_date", today)
        .order("created_at", { ascending: false }),
      supabase
        .from("tools")
        .select("*")
        .gt("min_quantity", 0)
        .order("name"),
      supabase
        .from("quality_measurements")
        .select("result")
        .gte("measured_at", `${today}T00:00:00`)
        .lte("measured_at", `${today}T23:59:59.999`),
      supabase
        .from("quality_measurements")
        .select(
          `id, job_id, measured_at, part_serial, measured_value,
           spec:quality_specs(description, bubble_no),
           job:jobs(part_name, customer)`,
        )
        .eq("result", "nok")
        .order("measured_at", { ascending: false })
        .limit(3),
    ]);

    const machines: Machine[] = machinesRes.data ?? [];
    const entries = (todayEntriesRes.data ?? []) as unknown as EntryRow[];

    // Latest entry per machine for the machines grid
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
      for (const e of (allEntries ?? []) as {
        job_id: string | null;
        produced_qty: number;
      }[]) {
        if (e.job_id) {
          totalsByJob.set(
            e.job_id,
            (totalsByJob.get(e.job_id) ?? 0) + (e.produced_qty ?? 0),
          );
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

    // Low stock = quantity at or below min_quantity (and min_quantity > 0)
    const tools = (lowStockRes.data ?? []) as Tool[];
    const lowStock = tools
      .filter((t) => t.quantity <= t.min_quantity)
      .sort((a, b) => a.quantity - b.quantity);

    // Shift summary — aggregate today's entries for the current shift,
    // grouped by machine.
    const byMachine = new Map<string, ShiftSummaryRow>();
    for (const e of entries) {
      if (e.shift !== currentShift) continue;
      const key = e.machine_id;
      const existing = byMachine.get(key);
      if (existing) {
        existing.produced += e.produced_qty ?? 0;
        existing.scrap += e.scrap_qty ?? 0;
      } else {
        byMachine.set(key, {
          machine_name: e.machine?.name ?? "—",
          operator_name: e.operator?.full_name ?? null,
          produced: e.produced_qty ?? 0,
          scrap: e.scrap_qty ?? 0,
        });
      }
    }
    const shiftRows = Array.from(byMachine.values()).sort(
      (a, b) => b.produced - a.produced,
    );

    // QC today rollup
    const qcToday = (qcTodayRes.data ?? []) as { result: string }[];
    const qcWidget: QualityWidgetData = {
      todayMeasurements: qcToday.length,
      todayOk: qcToday.filter((m) => m.result === "ok").length,
      todaySinirda: qcToday.filter((m) => m.result === "sinirda").length,
      todayNok: qcToday.filter((m) => m.result === "nok").length,
      recentNok:
        (qcRecentNokRes.data as unknown as QualityWidgetData["recentNok"]) ??
        [],
    };

    return {
      machineCards,
      lowStock,
      shiftRows,
      qcWidget,
      configured: true,
    };
  } catch {
    return {
      machineCards: [] as MachineCardData[],
      lowStock: [] as Tool[],
      shiftRows: [] as ShiftSummaryRow[],
      qcWidget: {
        todayMeasurements: 0,
        todayOk: 0,
        todaySinirda: 0,
        todayNok: 0,
        recentNok: [],
      } as QualityWidgetData,
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
                    <a
                      className="underline"
                      href="https://app.supabase.com"
                      target="_blank"
                      rel="noreferrer"
                    >
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
                    <code className="bg-muted px-1 rounded">
                      supabase/migrations/0001_init.sql
                    </code>{" "}
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
        description={formatDate(new Date()) + " · Atölye anlık durumu"}
      />

      {/* Top widgets row: Quality / Low stock / Shift summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        <QualityWidget data={data.qcWidget} />
        <LowStockWidget tools={data.lowStock} />
        <ShiftSummaryWidget rows={data.shiftRows} />
      </div>

      <MachinesGrid cards={data.machineCards} />
    </>
  );
}
