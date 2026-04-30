import { createClient } from "@/lib/supabase/server";
import type {
  Job,
  Machine,
  Operator,
  Product,
  ProductionEntry,
} from "@/lib/supabase/types";
import { JobsShell } from "./jobs-shell";
import {
  computeJobsRange,
  type JobsPeriod,
  type JobsRange,
} from "./date-range-filter";

export const metadata = { title: "İşler / Siparişler" };

const VALID_PERIODS: JobsPeriod[] = [
  "day",
  "week",
  "month",
  "year",
  "all",
  "custom",
];

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{
    period?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const sp = await searchParams;
  const period: JobsPeriod = VALID_PERIODS.includes(sp.period as JobsPeriod)
    ? (sp.period as JobsPeriod)
    : "all";

  const range: JobsRange = {
    period,
    from: sp.from ?? null,
    to: sp.to ?? null,
  };
  const { fromIso, toIso } = computeJobsRange(range);

  let jobs: Job[] = [];
  let machines: Machine[] = [];
  let operators: Operator[] = [];
  let products: Product[] = [];
  let productionEntries: Pick<
    ProductionEntry,
    "id" | "job_id" | "produced_qty" | "scrap_qty" | "entry_date" | "created_at"
  >[] = [];

  try {
    const supabase = await createClient();

    let jq = supabase
      .from("jobs")
      .select("*")
      .order("created_at", { ascending: false });
    if (fromIso) jq = jq.gte("created_at", fromIso);
    if (toIso) jq = jq.lte("created_at", toIso);

    const [jRes, mRes, oRes, pRes] = await Promise.all([
      jq,
      supabase.from("machines").select("*").order("name"),
      supabase.from("operators").select("*").order("full_name"),
      supabase.from("products").select("*").order("code"),
    ]);

    jobs = (jRes.data ?? []) as Job[];
    machines = (mRes.data ?? []) as Machine[];
    operators = (oRes.data ?? []) as Operator[];
    products = (pRes.data ?? []) as Product[];

    // Pull production entries only for the visible jobs to keep the
    // payload tight. Done counts come from sum(produced_qty).
    if (jobs.length > 0) {
      const jobIds = jobs.map((j) => j.id);
      const peRes = await supabase
        .from("production_entries")
        .select(
          "id, job_id, produced_qty, scrap_qty, entry_date, created_at",
        )
        .in("job_id", jobIds);
      productionEntries = (peRes.data ?? []) as typeof productionEntries;
    }
  } catch {
    /* not configured */
  }

  return (
    <JobsShell
      jobs={jobs}
      machines={machines}
      operators={operators}
      products={products}
      productionEntries={productionEntries}
      initialRange={range}
    />
  );
}
