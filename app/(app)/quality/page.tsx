import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { type QualitySummary } from "@/lib/supabase/types";
import { ClipboardCheck, Plus } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { SearchInput } from "@/components/app/search-input";
import { QualityList } from "./quality-list";

export const metadata = { title: "Kalite Kontrol" };

type FilterKey = "all" | "no_specs" | "in_progress" | "ready" | "with_nok";

export default async function QualityListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: FilterKey }>;
}) {
  const { q, filter = "all" } = await searchParams;

  let summaries: QualitySummary[] = [];

  try {
    const supabase = await createClient();
    let qbuilder = supabase
      .from("v_quality_summary")
      .select("*")
      .order("last_measured_at", { ascending: false, nullsFirst: false })
      .order("job_id", { ascending: false });

    if (q) {
      qbuilder = qbuilder.or(
        `customer.ilike.%${q}%,part_name.ilike.%${q}%,part_no.ilike.%${q}%,job_no.ilike.%${q}%`,
      );
    }

    const res = await qbuilder;
    summaries = (res.data ?? []) as QualitySummary[];
  } catch {
    /* not configured */
  }

  // client-side filter (the view doesn't have these as separate cols)
  const filtered = summaries.filter((s) => {
    if (filter === "no_specs") return s.spec_count === 0;
    if (filter === "in_progress")
      return s.spec_count > 0 && s.measurement_count < s.spec_count;
    if (filter === "ready")
      return s.spec_count > 0 && s.measurement_count >= s.spec_count;
    if (filter === "with_nok") return s.nok_count > 0;
    return true;
  });

  const counts = {
    total: summaries.length,
    no_specs: summaries.filter((s) => s.spec_count === 0).length,
    in_progress: summaries.filter(
      (s) => s.spec_count > 0 && s.measurement_count < s.spec_count,
    ).length,
    ready: summaries.filter(
      (s) => s.spec_count > 0 && s.measurement_count >= s.spec_count,
    ).length,
    with_nok: summaries.filter((s) => s.nok_count > 0).length,
  };

  return (
    <>
      <PageHeader
        title="Kalite Kontrol"
        description="İş bazında kalite spec'leri ve ölçüm kayıtları."
        actions={<SearchInput placeholder="İş no, müşteri, parça..." />}
      />

      <div className="flex gap-2 mb-4 flex-wrap">
        <FilterLink
          label={`Tümü (${counts.total})`}
          href="/quality"
          active={filter === "all"}
        />
        <FilterLink
          label={`Spec yok (${counts.no_specs})`}
          href="/quality?filter=no_specs"
          active={filter === "no_specs"}
        />
        <FilterLink
          label={`Ölçüm bekliyor (${counts.in_progress})`}
          href="/quality?filter=in_progress"
          active={filter === "in_progress"}
        />
        <FilterLink
          label={`Tamamlandı (${counts.ready})`}
          href="/quality?filter=ready"
          active={filter === "ready"}
        />
        <FilterLink
          label={`NOK var (${counts.with_nok})`}
          href="/quality?filter=with_nok"
          active={filter === "with_nok"}
          tone="bad"
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={ClipboardCheck}
              title={q ? "Eşleşen iş yok" : "Henüz kalite kaydı yok"}
              description={
                q
                  ? "Farklı bir arama dene."
                  : "Önce iş kaydı oluştur, sonra o iş için kalite spec'lerini ekle."
              }
              action={
                !q ? (
                  <Button asChild>
                    <Link href="/jobs">
                      <Plus className="size-4" /> İş Listesine Git
                    </Link>
                  </Button>
                ) : undefined
              }
            />
          </CardContent>
        </Card>
      ) : (
        <QualityList summaries={filtered} />
      )}
    </>
  );
}

function FilterLink({
  label,
  href,
  active,
  tone,
}: {
  label: string;
  href: string;
  active: boolean;
  tone?: "bad";
}) {
  const variant = active ? "default" : "outline";
  return (
    <Button
      asChild
      variant={variant}
      size="sm"
      className={tone === "bad" && !active ? "border-red-500/40 text-red-700" : ""}
    >
      <Link href={href}>{label}</Link>
    </Button>
  );
}
