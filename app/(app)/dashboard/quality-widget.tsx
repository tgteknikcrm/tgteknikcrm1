import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck, AlertOctagon, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type QualityWidgetData = {
  todayMeasurements: number;
  todayOk: number;
  todaySinirda: number;
  todayNok: number;
  recentNok: {
    id: string;
    job_id: string;
    measured_at: string;
    part_serial: string | null;
    measured_value: number;
    spec: { description: string; bubble_no: number | null } | null;
    job: { part_name: string; customer: string } | null;
  }[];
};

export function QualityWidget({ data }: { data: QualityWidgetData }) {
  const total = data.todayMeasurements;
  const okPct = total > 0 ? Math.round((data.todayOk / total) * 100) : 0;
  const nokPct = total > 0 ? Math.round((data.todayNok / total) * 100) : 0;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-md bg-emerald-500/15 flex items-center justify-center">
              <ClipboardCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Kalite Kontrol</div>
              <div className="text-sm font-semibold">Bugün</div>
            </div>
          </div>
          <Link
            href="/quality"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
          >
            Tümü <ArrowRight className="size-3" />
          </Link>
        </div>

        {total === 0 ? (
          <div className="rounded-lg border border-dashed py-6 text-center text-xs text-muted-foreground">
            Henüz ölçüm yok
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <Stat label="Ölçüm" value={total} />
              <Stat
                label="OK"
                value={`%${okPct}`}
                tone="emerald"
              />
              <Stat
                label="NOK"
                value={data.todayNok}
                tone={data.todayNok > 0 ? "red" : "muted"}
              />
            </div>

            {/* Mini progress bar (OK / Sınırda / NOK) */}
            <div className="h-1.5 rounded-full overflow-hidden bg-muted flex">
              {data.todayOk > 0 && (
                <div
                  className="bg-emerald-500"
                  style={{ width: `${(data.todayOk / total) * 100}%` }}
                />
              )}
              {data.todaySinirda > 0 && (
                <div
                  className="bg-amber-500"
                  style={{ width: `${(data.todaySinirda / total) * 100}%` }}
                />
              )}
              {data.todayNok > 0 && (
                <div
                  className="bg-red-500"
                  style={{ width: `${(data.todayNok / total) * 100}%` }}
                />
              )}
            </div>

            {data.recentNok.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <AlertOctagon className="size-3" /> Son NOK
                </div>
                {data.recentNok.slice(0, 2).map((m) => (
                  <Link
                    key={m.id}
                    href={`/quality/${m.job_id}`}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-red-500/5 hover:bg-red-500/10 transition text-xs"
                  >
                    <Badge
                      variant="outline"
                      className="font-mono text-[10px] border-red-300 text-red-700 dark:text-red-400 bg-red-500/10"
                    >
                      {m.spec?.bubble_no ? `#${m.spec.bubble_no}` : "—"}
                    </Badge>
                    <span className="truncate flex-1">
                      <span className="font-medium">
                        {m.job?.part_name ?? "—"}
                      </span>
                      <span className="text-muted-foreground"> · </span>
                      <span className="text-muted-foreground truncate">
                        {m.spec?.description ?? "—"}
                      </span>
                    </span>
                    <span className="font-mono tabular-nums text-red-700 dark:text-red-400 shrink-0">
                      {m.measured_value}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: number | string;
  tone?: "muted" | "emerald" | "red";
}) {
  return (
    <div className="rounded-md bg-muted/40 px-2 py-1.5 text-center">
      <div
        className={cn(
          "text-lg font-bold tabular-nums leading-tight",
          tone === "emerald" && "text-emerald-600 dark:text-emerald-400",
          tone === "red" && "text-red-600 dark:text-red-400",
        )}
      >
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}
