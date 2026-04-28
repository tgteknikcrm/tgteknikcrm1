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
  JOB_STATUS_LABEL,
  type Job,
  type JobStatus,
  type Machine,
  type Operator,
} from "@/lib/supabase/types";
import { Plus, FileText, ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";
import { SearchInput } from "@/components/app/search-input";
import { JobDialog } from "./job-dialog";
import { DeleteButton } from "../operators/delete-button";
import { deleteJob } from "./actions";

export const metadata = { title: "İşler / Siparişler" };

const STATUS_VARIANT: Record<JobStatus, "default" | "secondary" | "outline" | "destructive"> = {
  beklemede: "secondary",
  uretimde: "default",
  tamamlandi: "outline",
  iptal: "destructive",
};

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q, status } = await searchParams;

  let jobs: Array<Job & { machine_name?: string; operator_name?: string }> = [];
  let machines: Machine[] = [];
  let operators: Operator[] = [];

  try {
    const supabase = await createClient();
    let jq = supabase
      .from("jobs")
      .select("*, machines(name), operators(full_name)")
      .order("created_at", { ascending: false });

    if (q) {
      jq = jq.or(`job_no.ilike.%${q}%,customer.ilike.%${q}%,part_name.ilike.%${q}%`);
    }
    if (status && status !== "all") {
      jq = jq.eq("status", status);
    }

    const [jobsRes, mRes, oRes] = await Promise.all([
      jq,
      supabase.from("machines").select("*").order("name"),
      supabase.from("operators").select("*").eq("active", true).order("full_name"),
    ]);

    type JobRow = Job & {
      machines?: { name: string } | null;
      operators?: { full_name: string } | null;
    };
    jobs = (jobsRes.data ?? []).map((j: JobRow) => ({
      ...j,
      machine_name: j.machines?.name,
      operator_name: j.operators?.full_name,
    }));
    machines = mRes.data ?? [];
    operators = oRes.data ?? [];
  } catch {
    /* not configured */
  }

  return (
    <>
      <PageHeader
        title="İşler / Siparişler"
        description="Tüm müşteri işleri ve üretim siparişleri"
        actions={
          <>
            <SearchInput placeholder="İş no, müşteri, parça..." />
            <JobDialog
              machines={machines}
              operators={operators}
              trigger={
                <Button>
                  <Plus className="size-4" /> Yeni İş
                </Button>
              }
            />
          </>
        }
      />

      <div className="flex gap-2 mb-4 flex-wrap">
        <FilterLink label="Tümü" href="/jobs" active={!status || status === "all"} />
        <FilterLink label="Beklemede" href="/jobs?status=beklemede" active={status === "beklemede"} />
        <FilterLink label="Üretimde" href="/jobs?status=uretimde" active={status === "uretimde"} />
        <FilterLink label="Tamamlandı" href="/jobs?status=tamamlandi" active={status === "tamamlandi"} />
      </div>

      <Card>
        <CardContent className="p-0">
          {jobs.length === 0 ? (
            <EmptyState
              icon={FileText}
              title={q || status ? "Eşleşen iş yok" : "Henüz iş yok"}
              description="Yeni iş ekleyerek başlayın."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
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
                  <TableRow key={j.id}>
                    <TableCell className="font-mono text-xs">{j.job_no || "—"}</TableCell>
                    <TableCell className="font-medium">{j.customer}</TableCell>
                    <TableCell>
                      {j.part_name}
                      {j.part_no && (
                        <span className="text-muted-foreground text-xs"> · {j.part_no}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">{j.quantity}</TableCell>
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
                        <Button asChild variant="ghost" size="sm" title="Kalite Kontrol">
                          <Link href={`/quality/${j.id}`}>
                            <ClipboardCheck className="size-4" /> Kalite
                          </Link>
                        </Button>
                        <JobDialog
                          job={j}
                          machines={machines}
                          operators={operators}
                          trigger={
                            <Button variant="ghost" size="sm">
                              Düzenle
                            </Button>
                          }
                        />
                        <DeleteButton
                          action={async () => {
                            "use server";
                            return deleteJob(j.id);
                          }}
                          confirmText={`'${j.part_name}' işi silinsin mi?`}
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

function FilterLink({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Button asChild variant={active ? "default" : "outline"} size="sm">
      <Link href={href}>{label}</Link>
    </Button>
  );
}
