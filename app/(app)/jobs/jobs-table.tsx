"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ClipboardCheck, Wrench } from "lucide-react";
import {
  JOB_STATUS_LABEL,
  type Job,
  type JobStatus,
  type Machine,
  type Operator,
  type Product,
} from "@/lib/supabase/types";
import { JobDialog } from "./job-dialog";
import { JobToolsDialog } from "./job-tools-dialog";
import { DeleteButton } from "../operators/delete-button";
import { bulkDeleteJobs, deleteJob } from "./actions";
import { useBulkSelection } from "@/lib/use-bulk-selection";
import { BulkActionsBar } from "@/components/app/bulk-actions-bar";

const STATUS_VARIANT: Record<
  JobStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  beklemede: "secondary",
  uretimde: "default",
  tamamlandi: "outline",
  iptal: "destructive",
};

type JobRow = Job & { machine_name?: string; operator_name?: string };

export function JobsTable({
  jobs,
  machines,
  operators,
  products,
}: {
  jobs: JobRow[];
  machines: Machine[];
  operators: Operator[];
  products: Product[];
}) {
  const router = useRouter();
  const ids = useMemo(() => jobs.map((j) => j.id), [jobs]);
  const sel = useBulkSelection(ids);

  return (
    <>
      <BulkActionsBar
        count={sel.size}
        total={ids.length}
        onSelectAll={sel.selectAll}
        onClear={sel.clear}
        ids={sel.ids}
        itemLabel="iş"
        onDelete={async (toDelete) => {
          const r = await bulkDeleteJobs(toDelete);
          router.refresh();
          return r;
        }}
      />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={
                  sel.allSelected
                    ? true
                    : sel.someSelected
                      ? "indeterminate"
                      : false
                }
                onCheckedChange={(v) => (v ? sel.selectAll() : sel.clear())}
                aria-label="Tümünü seç"
              />
            </TableHead>
            <TableHead>İş No</TableHead>
            <TableHead>Müşteri</TableHead>
            <TableHead>Parça</TableHead>
            <TableHead className="text-right">Adet</TableHead>
            <TableHead>Makine</TableHead>
            <TableHead>Operatör</TableHead>
            <TableHead>Teslim</TableHead>
            <TableHead>Durum</TableHead>
            <TableHead className="text-right">İşlem</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((j) => (
            <TableRow
              key={j.id}
              className={sel.has(j.id) ? "bg-primary/5" : undefined}
            >
              <TableCell>
                <Checkbox
                  checked={sel.has(j.id)}
                  onCheckedChange={() => sel.toggle(j.id)}
                  onClick={(e) => {
                    if ((e as React.MouseEvent).shiftKey) {
                      e.preventDefault();
                      sel.toggleRange(j.id);
                    }
                  }}
                />
              </TableCell>
              <TableCell className="font-mono text-xs">
                {j.job_no || "—"}
              </TableCell>
              <TableCell className="font-medium">{j.customer}</TableCell>
              <TableCell>
                {j.part_name}
                {j.part_no && (
                  <span className="text-muted-foreground text-xs">
                    {" "}
                    · {j.part_no}
                  </span>
                )}
              </TableCell>
              <TableCell className="text-right font-mono">
                {j.quantity}
              </TableCell>
              <TableCell>{j.machine_name || "—"}</TableCell>
              <TableCell>{j.operator_name || "—"}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {j.due_date || "—"}
              </TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANT[j.status]}>
                  {JOB_STATUS_LABEL[j.status]}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex gap-1 justify-end">
                  <JobToolsDialog
                    jobId={j.id}
                    jobLabel={j.part_name}
                    trigger={
                      <Button variant="ghost" size="sm" title="Takım Ata">
                        <Wrench className="size-4" /> Takım
                      </Button>
                    }
                  />
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    title="Kalite Kontrol"
                  >
                    <Link href={`/quality/${j.id}`}>
                      <ClipboardCheck className="size-4" /> Kalite
                    </Link>
                  </Button>
                  <JobDialog
                    job={j}
                    machines={machines}
                    operators={operators}
                    products={products}
                    trigger={
                      <Button variant="ghost" size="sm">
                        Düzenle
                      </Button>
                    }
                  />
                  <DeleteButton
                    action={() => deleteJob(j.id)}
                    confirmText={`'${j.part_name}' işi silinsin mi?`}
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
