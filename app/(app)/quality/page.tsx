import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import {
  JOB_STATUS_LABEL,
  type QualitySummary,
  type JobStatus,
} from "@/lib/supabase/types";
import {
  ClipboardCheck,
  Ruler,
  Gauge,
  AlertCircle,
  ArrowRight,
  Plus,
} from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { SearchInput } from "@/components/app/search-input";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Kalite Kontrol" };

const STATUS_CLS: Record<JobStatus, string> = {
  beklemede: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30",
  ayar:
    "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  uretimde:
    "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  tamamlandi:
    "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  iptal: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
};

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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((s) => (
            <QualityCard key={s.job_id} summary={s} />
          ))}
        </div>
      )}
    </>
  );
}

function QualityCard({ summary: s }: { summary: QualitySummary }) {
  const okPct =
    s.measurement_count > 0
      ? Math.round((s.ok_count / s.measurement_count) * 100)
      : 0;
  const statusCls = STATUS_CLS[s.job_status] ?? STATUS_CLS.beklemede;
  const accent =
    s.nok_count > 0
      ? "border-l-red-500"
      : s.sinirda_count > 0
      ? "border-l-amber-500"
      : s.measurement_count > 0
      ? "border-l-emerald-500"
      : "border-l-zinc-300 dark:border-l-zinc-700";

  return (
    <Card className={`border-l-4 ${accent} hover:shadow-md transition`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-xs text-muted-foreground font-mono">
              {s.job_no || "—"}
            </div>
            <h3 className="font-semibold truncate">{s.part_name}</h3>
            <p className="text-sm text-muted-foreground truncate">
              {s.customer}
              {s.part_no && ` · ${s.part_no}`}
            </p>
          </div>
          <Badge variant="outline" className={`${statusCls} font-medium`}>
            {JOB_STATUS_LABEL[s.job_status]}
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-2 border-t">
          <Stat
            icon={Ruler}
            label="Spec"
            value={s.spec_count}
            hint={
              s.critical_spec_count > 0 ? `${s.critical_spec_count} kritik` : undefined
            }
          />
          <Stat
            icon={Gauge}
            label="Ölçüm"
            value={s.measurement_count}
            hint={
              s.measurement_count > 0
                ? `%${okPct} OK`
                : undefined
            }
          />
          <Stat
            icon={AlertCircle}
            label="NOK"
            value={s.nok_count}
            tone={s.nok_count > 0 ? "bad" : undefined}
            hint={
              s.sinirda_count > 0 ? `${s.sinirda_count} sınırda` : undefined
            }
          />
        </div>

        {s.measurement_count > 0 && (
          <div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden flex">
              <div
                className="h-full bg-emerald-500"
                style={{
                  width: `${(s.ok_count / s.measurement_count) * 100}%`,
                }}
              />
              <div
                className="h-full bg-amber-500"
                style={{
                  width: `${(s.sinirda_count / s.measurement_count) * 100}%`,
                }}
              />
              <div
                className="h-full bg-red-500"
                style={{
                  width: `${(s.nok_count / s.measurement_count) * 100}%`,
                }}
              />
            </div>
            {s.last_measured_at && (
              <p className="text-[11px] text-muted-foreground mt-1.5 tabular-nums">
                Son ölçüm: {formatDateTime(s.last_measured_at)}
              </p>
            )}
          </div>
        )}

        <Button asChild variant="outline" size="sm" className="w-full">
          <Link href={`/quality/${s.job_id}`}>
            {s.spec_count === 0 ? "Spec Ekle" : "Yönet"}
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof Ruler;
  label: string;
  value: number;
  hint?: string;
  tone?: "bad";
}) {
  return (
    <div className="text-center">
      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-center gap-1">
        <Icon className="size-3" />
        {label}
      </div>
      <div
        className={`text-xl font-bold tabular-nums ${
          tone === "bad" && value > 0 ? "text-red-600" : ""
        }`}
      >
        {value}
      </div>
      {hint && (
        <div className="text-[10px] text-muted-foreground">{hint}</div>
      )}
    </div>
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
