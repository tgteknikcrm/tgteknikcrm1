"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowRight,
  Ruler,
  Gauge,
  AlertCircle,
  Trash2,
  CheckSquare,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { JOB_STATUS_LABEL, type JobStatus, type QualitySummary } from "@/lib/supabase/types";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useBulkSelection } from "@/lib/use-bulk-selection";
import { BulkActionsBar } from "@/components/app/bulk-actions-bar";
import { clearQualityForJob, bulkClearQualityForJobs } from "./actions";

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

export function QualityList({ summaries }: { summaries: QualitySummary[] }) {
  const router = useRouter();
  const [bulkMode, setBulkMode] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const ids = useMemo(() => summaries.map((s) => s.job_id), [summaries]);
  const sel = useBulkSelection(ids);

  function exitBulkMode() {
    setBulkMode(false);
    sel.clear();
  }

  function clearOne(s: QualitySummary) {
    const has = s.spec_count + s.measurement_count > 0;
    const msg = has
      ? `'${s.part_name}' işine ait ${s.spec_count} spec ve ${s.measurement_count} ölçüm silinsin mi?\n\nİş kaydı SİLİNMEZ — sadece kalite verisi temizlenir.\n\nBu işlem geri alınamaz.`
      : `'${s.part_name}' için kalite verisi zaten boş. Yine de tetiklensin mi?`;
    if (!confirm(msg)) return;
    setPendingId(s.job_id);
    startTransition(async () => {
      const r = await clearQualityForJob(s.job_id);
      setPendingId(null);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(
        `Temizlendi: ${r.removedSpecs} spec, ${r.removedMeasurements} ölçüm`,
      );
      router.refresh();
    });
  }

  return (
    <>
      {/* Toolbar action: bulk-mode toggle */}
      <div className="flex items-center justify-end mb-3">
        <Button
          type="button"
          variant={bulkMode ? "default" : "outline"}
          size="sm"
          onClick={() => (bulkMode ? exitBulkMode() : setBulkMode(true))}
          className="h-9 gap-1.5"
        >
          <CheckSquare className="size-4" />
          {bulkMode ? "Çıkış" : "Toplu Temizle"}
        </Button>
      </div>

      <BulkActionsBar
        count={sel.size}
        total={ids.length}
        onSelectAll={sel.selectAll}
        onClear={() => {
          sel.clear();
          setBulkMode(false);
        }}
        ids={sel.ids}
        itemLabel="iş kalitesi"
        onDelete={async (jobIds) => {
          const r = await bulkClearQualityForJobs(jobIds);
          if (!r.error) router.refresh();
          return r;
        }}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {summaries.map((s) => (
          <QualityCard
            key={s.job_id}
            summary={s}
            bulkMode={bulkMode}
            selected={sel.has(s.job_id)}
            onToggleSelect={() => sel.toggle(s.job_id)}
            onClear={() => clearOne(s)}
            isPending={pendingId === s.job_id}
          />
        ))}
      </div>
    </>
  );
}

function QualityCard({
  summary: s,
  bulkMode,
  selected,
  onToggleSelect,
  onClear,
  isPending,
}: {
  summary: QualitySummary;
  bulkMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onClear: () => void;
  isPending: boolean;
}) {
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
    <Card
      className={cn(
        "relative border-l-4 hover:shadow-md transition group",
        accent,
        bulkMode && selected && "ring-2 ring-primary bg-primary/5",
      )}
      onClick={bulkMode ? onToggleSelect : undefined}
      role={bulkMode ? "button" : undefined}
    >
      {/* Bulk-mode checkbox */}
      {bulkMode && (
        <div className="absolute top-2 left-2 z-10">
          <Checkbox
            checked={selected}
            onCheckedChange={() => undefined}
            className="bg-background shadow-sm border-2"
            aria-label="Seç"
          />
        </div>
      )}

      {/* Hover-only Trash button (top-right) — outside bulk mode */}
      {!bulkMode && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onClear();
          }}
          disabled={isPending}
          className={cn(
            "absolute top-2 right-2 z-10 size-7 rounded-md flex items-center justify-center",
            "opacity-0 group-hover:opacity-100 transition",
            "bg-background/80 hover:bg-red-500/15 text-muted-foreground hover:text-red-700",
            "border border-transparent hover:border-red-500/40",
          )}
          title="Bu işin spec ve ölçümlerini temizle (iş kalır)"
          aria-label="Kalite verisini temizle"
        >
          {isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Trash2 className="size-3.5" />
          )}
        </button>
      )}

      <CardContent className={cn("p-4 space-y-3", bulkMode && "pl-10")}>
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
              s.critical_spec_count > 0
                ? `${s.critical_spec_count} kritik`
                : undefined
            }
          />
          <Stat
            icon={Gauge}
            label="Ölçüm"
            value={s.measurement_count}
            hint={s.measurement_count > 0 ? `%${okPct} OK` : undefined}
          />
          <Stat
            icon={AlertCircle}
            label="NOK"
            value={s.nok_count}
            tone={s.nok_count > 0 ? "bad" : undefined}
            hint={s.sinirda_count > 0 ? `${s.sinirda_count} sınırda` : undefined}
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

        {!bulkMode && (
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link href={`/quality/${s.job_id}`}>
              {s.spec_count === 0 ? "Spec Ekle" : "Yönet"}
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        )}
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
        className={cn(
          "text-xl font-bold tabular-nums",
          tone === "bad" && value > 0 && "text-red-600",
        )}
      >
        {value}
      </div>
      {hint && (
        <div className="text-[10px] text-muted-foreground">{hint}</div>
      )}
    </div>
  );
}
