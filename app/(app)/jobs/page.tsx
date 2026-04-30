import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import {
  type Job,
  type Machine,
  type Operator,
  type Product,
} from "@/lib/supabase/types";
import { Plus, FileText } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";
import { SearchInput } from "@/components/app/search-input";
import { JobDialog } from "./job-dialog";
import { JobsTable } from "./jobs-table";

export const metadata = { title: "İşler / Siparişler" };

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q, status } = await searchParams;

  let jobs: Array<Job & { machine_name?: string; operator_name?: string }> = [];
  let machines: Machine[] = [];
  let operators: Operator[] = [];
  let products: Product[] = [];

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

    const [jobsRes, mRes, oRes, pRes] = await Promise.all([
      jq,
      supabase.from("machines").select("*").order("name"),
      supabase.from("operators").select("*").eq("active", true).order("full_name"),
      supabase.from("products").select("*").order("code"),
    ]);
    products = (pRes.data ?? []) as Product[];

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
              products={products}
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
            <JobsTable
              jobs={jobs}
              machines={machines}
              operators={operators}
              products={products}
            />
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
