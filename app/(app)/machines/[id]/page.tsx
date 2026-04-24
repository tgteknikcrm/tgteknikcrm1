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
import { PageHeader } from "@/components/app/page-header";
import { createClient } from "@/lib/supabase/server";
import {
  MACHINE_STATUS_COLOR,
  MACHINE_STATUS_LABEL,
  SHIFT_LABEL,
  type Machine,
  type ProductionEntry,
} from "@/lib/supabase/types";
import { ArrowLeft, Factory } from "lucide-react";
import { MachineDialog } from "../machine-dialog";

export default async function MachineDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let machine: Machine | null = null;
  let entries: Array<ProductionEntry & { operator_name?: string; job_no?: string }> = [];

  try {
    const supabase = await createClient();
    const [machineRes, entriesRes] = await Promise.all([
      supabase.from("machines").select("*").eq("id", id).single(),
      supabase
        .from("production_entries")
        .select("*, operators(full_name), jobs(job_no, part_name)")
        .eq("machine_id", id)
        .order("entry_date", { ascending: false })
        .limit(30),
    ]);
    machine = machineRes.data as Machine | null;
    entries = (entriesRes.data ?? []).map((e: ProductionEntry & {
      operators?: { full_name: string } | null;
      jobs?: { job_no: string; part_name: string } | null;
    }) => ({
      ...e,
      operator_name: e.operators?.full_name,
      job_no: e.jobs?.job_no,
    }));
  } catch {
    notFound();
  }

  if (!machine) notFound();

  return (
    <>
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/machines">
            <ArrowLeft className="size-4" /> Tüm Makineler
          </Link>
        </Button>
      </div>

      <PageHeader
        title={machine.name}
        description={`${machine.type}${machine.model ? " · " + machine.model : ""}`}
        actions={
          <>
            <Badge variant="outline" className="gap-1.5 text-sm">
              <span className={`size-2 rounded-full ${MACHINE_STATUS_COLOR[machine.status]}`} />
              {MACHINE_STATUS_LABEL[machine.status]}
            </Badge>
            <MachineDialog
              machine={machine}
              trigger={<Button variant="outline">Düzenle</Button>}
            />
          </>
        }
      />

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Factory className="size-5 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">Seri No</div>
                <div className="font-medium">{machine.serial_no || "—"}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Konum</div>
            <div className="font-medium mt-1">{machine.location || "—"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Son Güncelleme</div>
            <div className="font-medium mt-1">
              {new Date(machine.updated_at).toLocaleDateString("tr-TR")}
            </div>
          </CardContent>
        </Card>
      </div>

      {machine.notes && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-sm">Notlar</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{machine.notes}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Son 30 Üretim Kaydı</CardTitle>
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
                  <TableHead>İş</TableHead>
                  <TableHead className="text-right">Üretim</TableHead>
                  <TableHead className="text-right">Fire</TableHead>
                  <TableHead className="text-right">Duruş (dk)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{e.entry_date}</TableCell>
                    <TableCell>{SHIFT_LABEL[e.shift]}</TableCell>
                    <TableCell>{e.operator_name || "—"}</TableCell>
                    <TableCell>{e.job_no || "—"}</TableCell>
                    <TableCell className="text-right font-mono">{e.produced_qty}</TableCell>
                    <TableCell className="text-right font-mono text-amber-600">
                      {e.scrap_qty}
                    </TableCell>
                    <TableCell className="text-right font-mono">{e.downtime_minutes}</TableCell>
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
