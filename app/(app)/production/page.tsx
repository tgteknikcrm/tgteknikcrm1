import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
  SHIFT_LABEL,
  type Job,
  type Machine,
  type Operator,
  type ProductionEntry,
} from "@/lib/supabase/types";
import { Plus, ClipboardList } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { EntryDialog } from "./entry-dialog";
import { DeleteButton } from "../operators/delete-button";
import { deleteProductionEntry } from "./actions";

export const metadata = { title: "Üretim Formları" };

export default async function ProductionPage() {
  let entries: Array<
    ProductionEntry & {
      machine_name?: string;
      operator_name?: string;
      job_label?: string;
    }
  > = [];
  let machines: Machine[] = [];
  let operators: Operator[] = [];
  let jobs: Job[] = [];

  try {
    const supabase = await createClient();
    const [eRes, mRes, oRes, jRes] = await Promise.all([
      supabase
        .from("production_entries")
        .select("*, machines(name), operators(full_name), jobs(job_no, customer, part_name)")
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("machines").select("*").order("name"),
      supabase.from("operators").select("*").eq("active", true).order("full_name"),
      supabase
        .from("jobs")
        .select("*")
        .in("status", ["beklemede", "uretimde"])
        .order("created_at", { ascending: false }),
    ]);

    type EntryRow = ProductionEntry & {
      machines?: { name: string } | null;
      operators?: { full_name: string } | null;
      jobs?: { job_no: string | null; customer: string; part_name: string } | null;
    };

    entries = (eRes.data ?? []).map((e: EntryRow) => ({
      ...e,
      machine_name: e.machines?.name,
      operator_name: e.operators?.full_name,
      job_label: e.jobs
        ? `${e.jobs.job_no ? e.jobs.job_no + " · " : ""}${e.jobs.customer} - ${e.jobs.part_name}`
        : undefined,
    }));
    machines = mRes.data ?? [];
    operators = oRes.data ?? [];
    jobs = jRes.data ?? [];
  } catch {
    /* not configured */
  }

  return (
    <>
      <PageHeader
        title="Üretim Formları"
        description="Günlük vardiya bazlı üretim kayıtları"
        actions={
          <EntryDialog
            machines={machines}
            operators={operators}
            jobs={jobs}
            trigger={
              <Button disabled={machines.length === 0}>
                <Plus className="size-4" /> Yeni Form
              </Button>
            }
          />
        }
      />

      <Card>
        <CardContent className="p-0">
          {entries.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="Henüz üretim formu yok"
              description="İlk formu oluşturarak günlük takibe başlayın."
            />
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
                  <TableHead className="text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-xs">{e.entry_date}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{SHIFT_LABEL[e.shift]}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{e.machine_name || "—"}</TableCell>
                    <TableCell>{e.operator_name || "—"}</TableCell>
                    <TableCell className="max-w-xs truncate">{e.job_label || "—"}</TableCell>
                    <TableCell className="text-right font-mono">{e.produced_qty}</TableCell>
                    <TableCell className="text-right font-mono text-amber-600">
                      {e.scrap_qty}
                    </TableCell>
                    <TableCell className="text-right font-mono">{e.downtime_minutes}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <EntryDialog
                          entry={e}
                          machines={machines}
                          operators={operators}
                          jobs={jobs}
                          trigger={
                            <Button variant="ghost" size="sm">
                              Düzenle
                            </Button>
                          }
                        />
                        <DeleteButton
                          action={async () => {
                            "use server";
                            return deleteProductionEntry(e.id);
                          }}
                          confirmText="Bu üretim kaydı silinsin mi?"
                        />
                      </div>
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
