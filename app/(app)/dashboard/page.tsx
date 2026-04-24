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
} from "lucide-react";
import { MACHINE_STATUS_COLOR, MACHINE_STATUS_LABEL, SHIFT_LABEL } from "@/lib/supabase/types";
import type { Machine, ProductionEntry } from "@/lib/supabase/types";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

export const metadata = { title: "Dashboard" };

async function getDashboardData() {
  try {
    const supabase = await createClient();

    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10);

    const [machinesRes, todayRes, weekRes, openJobsRes, toolsLowRes, operatorsRes] =
      await Promise.all([
        supabase.from("machines").select("*").order("name"),
        supabase
          .from("production_entries")
          .select("produced_qty, scrap_qty, downtime_minutes")
          .eq("entry_date", today),
        supabase
          .from("production_entries")
          .select("entry_date, produced_qty")
          .gte("entry_date", weekAgo),
        supabase
          .from("jobs")
          .select("id", { count: "exact", head: true })
          .in("status", ["beklemede", "uretimde"]),
        supabase
          .from("tools")
          .select("id, name, quantity, min_quantity")
          .order("quantity"),
        supabase.from("operators").select("id", { count: "exact", head: true }).eq("active", true),
      ]);

    const machines: Machine[] = machinesRes.data ?? [];
    const todayEntries = (todayRes.data ?? []) as Pick<ProductionEntry, "produced_qty" | "scrap_qty" | "downtime_minutes">[];
    const todayProduced = todayEntries.reduce((s, e) => s + (e.produced_qty ?? 0), 0);
    const todayScrap = todayEntries.reduce((s, e) => s + (e.scrap_qty ?? 0), 0);
    const todayDowntime = todayEntries.reduce((s, e) => s + (e.downtime_minutes ?? 0), 0);

    const weekByDate = new Map<string, number>();
    for (const row of (weekRes.data ?? []) as { entry_date: string; produced_qty: number }[]) {
      weekByDate.set(row.entry_date, (weekByDate.get(row.entry_date) ?? 0) + row.produced_qty);
    }

    const toolsLow = (toolsLowRes.data ?? []).filter(
      (t) => (t.quantity ?? 0) <= (t.min_quantity ?? 0),
    );

    return {
      machines,
      todayProduced,
      todayScrap,
      todayDowntime,
      openJobs: openJobsRes.count ?? 0,
      activeOperators: operatorsRes.count ?? 0,
      toolsLow,
      weekByDate,
      configured: true,
    };
  } catch {
    return {
      machines: [],
      todayProduced: 0,
      todayScrap: 0,
      todayDowntime: 0,
      openJobs: 0,
      activeOperators: 0,
      toolsLow: [],
      weekByDate: new Map<string, number>(),
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
        <StatCard
          icon={Users}
          label="Aktif Operatör"
          value={data.activeOperators}
        />
        <StatCard
          icon={AlertCircle}
          label="Eksik Takım"
          value={data.toolsLow.length}
          hint={data.toolsLow.length ? "stok altında" : "ok"}
          tone={data.toolsLow.length ? "warn" : "default"}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Factory className="size-4" /> Makine Durumu
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.machines.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Henüz makine yok. Seed verisi çalışmadı mı?
              </p>
            ) : (
              data.machines.map((m) => (
                <Link
                  key={m.id}
                  href={`/machines/${m.id}`}
                  className="flex items-center justify-between p-3 rounded-md border hover:bg-accent transition"
                >
                  <div className="flex items-center gap-3">
                    <span className={`size-2.5 rounded-full ${MACHINE_STATUS_COLOR[m.status]}`} />
                    <div>
                      <div className="font-medium">{m.name}</div>
                      {m.model && (
                        <div className="text-xs text-muted-foreground">{m.model}</div>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline">{MACHINE_STATUS_LABEL[m.status]}</Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

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
      </div>

      <Card className="mt-6">
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
            <div className={`text-2xl font-semibold mt-1 ${tone === "warn" ? "text-amber-600" : ""}`}>
              {value}
            </div>
            {hint && (
              <div className="text-xs text-muted-foreground mt-1">{hint}</div>
            )}
          </div>
          <Icon className={`size-5 ${tone === "warn" ? "text-amber-600" : "text-muted-foreground"}`} />
        </div>
      </CardContent>
    </Card>
  );
}
