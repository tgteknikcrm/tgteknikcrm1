import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/app/page-header";
import { createClient } from "@/lib/supabase/server";
import { AlertCircle } from "lucide-react";
import type { Machine } from "@/lib/supabase/types";
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

    const [machinesRes, todayEntriesRes] = await Promise.all([
      supabase.from("machines").select("*").order("name"),
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
    const entries = (todayEntriesRes.data ?? []) as unknown as EntryRow[];

    // Latest entry per machine — that's the "currently producing" job
    // we render on each machine card.
    const latestByMachine = new Map<string, EntryRow>();
    for (const e of entries) {
      if (!latestByMachine.has(e.machine_id) && e.job) {
        latestByMachine.set(e.machine_id, e);
      }
    }

    // Total produced per active job (across all entries) so the cards
    // can render a progress bar.
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

    return { machineCards, configured: true };
  } catch {
    return { machineCards: [] as MachineCardData[], configured: false };
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

      <MachinesGrid cards={data.machineCards} />
    </>
  );
}
