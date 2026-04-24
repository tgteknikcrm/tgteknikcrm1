import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import {
  SHIFT_LABEL,
  type ProductionEntry,
} from "@/lib/supabase/types";
import Link from "next/link";
import { ExportButton } from "./export-button";

export const metadata = { title: "Raporlar" };

function addDays(iso: string, days: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const from = sp.from || addDays(today, -30);
  const to = sp.to || today;

  type ReportRow = ProductionEntry & {
    machine_name?: string;
    operator_name?: string;
    job_label?: string;
  };

  let rows: ReportRow[] = [];

  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("production_entries")
      .select("*, machines(name), operators(full_name), jobs(job_no, customer, part_name)")
      .gte("entry_date", from)
      .lte("entry_date", to)
      .order("entry_date", { ascending: false });
    type EntryRow = ProductionEntry & {
      machines?: { name: string } | null;
      operators?: { full_name: string } | null;
      jobs?: { job_no: string | null; customer: string; part_name: string } | null;
    };
    rows = (data ?? []).map((r: EntryRow) => ({
      ...r,
      machine_name: r.machines?.name,
      operator_name: r.operators?.full_name,
      job_label: r.jobs
        ? `${r.jobs.job_no ? r.jobs.job_no + " · " : ""}${r.jobs.customer} - ${r.jobs.part_name}`
        : undefined,
    }));
  } catch {
    /* not configured */
  }

  const totals = rows.reduce(
    (acc, r) => {
      acc.produced += r.produced_qty;
      acc.scrap += r.scrap_qty;
      acc.downtime += r.downtime_minutes;
      return acc;
    },
    { produced: 0, scrap: 0, downtime: 0 },
  );

  // per-machine aggregation
  const perMachine = new Map<string, { produced: number; scrap: number; downtime: number }>();
  for (const r of rows) {
    const k = r.machine_name || "—";
    const agg = perMachine.get(k) ?? { produced: 0, scrap: 0, downtime: 0 };
    agg.produced += r.produced_qty;
    agg.scrap += r.scrap_qty;
    agg.downtime += r.downtime_minutes;
    perMachine.set(k, agg);
  }

  return (
    <>
      <PageHeader
        title="Raporlar"
        description={`${from} → ${to} arası üretim raporu`}
        actions={<ExportButton rows={rows} from={from} to={to} />}
      />

      <form className="mb-6 flex flex-wrap gap-3 items-end" action="/reports">
        <div className="space-y-1.5">
          <label className="text-xs font-medium">Başlangıç</label>
          <input
            type="date"
            name="from"
            defaultValue={from}
            className="flex h-9 rounded-md border bg-transparent px-3 py-1 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium">Bitiş</label>
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="flex h-9 rounded-md border bg-transparent px-3 py-1 text-sm"
          />
        </div>
        <Button type="submit">Filtrele</Button>
        <Button asChild variant="outline">
          <Link href="/reports">Sıfırla</Link>
        </Button>
      </form>

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Toplam Üretim</div>
            <div className="text-2xl font-semibold mt-1">{totals.produced}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Toplam Fire</div>
            <div className="text-2xl font-semibold text-amber-600 mt-1">{totals.scrap}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Toplam Duruş</div>
            <div className="text-2xl font-semibold mt-1">{totals.downtime} dk</div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Makine Bazlı Özet</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Makine</TableHead>
                <TableHead className="text-right">Üretim</TableHead>
                <TableHead className="text-right">Fire</TableHead>
                <TableHead className="text-right">Duruş (dk)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...perMachine.entries()].map(([name, agg]) => (
                <TableRow key={name}>
                  <TableCell className="font-medium">{name}</TableCell>
                  <TableCell className="text-right font-mono">{agg.produced}</TableCell>
                  <TableCell className="text-right font-mono text-amber-600">{agg.scrap}</TableCell>
                  <TableCell className="text-right font-mono">{agg.downtime}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detaylı Kayıtlar ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Bu aralıkta kayıt yok.
            </div>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.entry_date}</TableCell>
                    <TableCell>{SHIFT_LABEL[r.shift]}</TableCell>
                    <TableCell>{r.machine_name || "—"}</TableCell>
                    <TableCell>{r.operator_name || "—"}</TableCell>
                    <TableCell className="max-w-xs truncate">{r.job_label || "—"}</TableCell>
                    <TableCell className="text-right font-mono">{r.produced_qty}</TableCell>
                    <TableCell className="text-right font-mono text-amber-600">
                      {r.scrap_qty}
                    </TableCell>
                    <TableCell className="text-right font-mono">{r.downtime_minutes}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={5} className="font-semibold">TOPLAM</TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    {totals.produced}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold text-amber-600">
                    {totals.scrap}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold">{totals.downtime}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
