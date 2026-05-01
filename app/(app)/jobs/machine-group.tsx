"use client";

import { Badge } from "@/components/ui/badge";
import {
  AlertOctagon,
  Cog,
  Pause,
  PowerOff,
  Wrench,
} from "lucide-react";
import {
  formatMinutes,
  MACHINE_STATUS_LABEL,
  type Machine,
  type MachineStatus,
  type Operator,
  type Product,
  type WorkSchedule,
} from "@/lib/supabase/types";
import { JobCard, type JobCardData } from "./job-card";
import { cn } from "@/lib/utils";

const STATUS_ICON: Record<MachineStatus, React.ComponentType<{ className?: string }>> = {
  aktif: Cog,
  durus: Pause,
  bakim: Wrench,
  ariza: AlertOctagon,
};

const STATUS_TONE: Record<MachineStatus, { ring: string; bg: string; text: string; dot: string }> = {
  aktif: {
    ring: "ring-emerald-500/30",
    bg: "bg-emerald-500/10",
    text: "text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  durus: {
    ring: "ring-zinc-500/30",
    bg: "bg-zinc-500/10",
    text: "text-zinc-700 dark:text-zinc-300",
    dot: "bg-zinc-500",
  },
  bakim: {
    ring: "ring-amber-500/30",
    bg: "bg-amber-500/10",
    text: "text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  ariza: {
    ring: "ring-rose-500/30",
    bg: "bg-rose-500/10",
    text: "text-rose-700 dark:text-rose-300",
    dot: "bg-rose-500",
  },
};

export function MachineGroup({
  machine,
  jobs,
  machines,
  operators,
  products,
  totalRemainingMinutes,
  workSchedule,
}: {
  machine: Machine | null;
  jobs: JobCardData[];
  machines: Machine[];
  operators: Operator[];
  products: Product[];
  totalRemainingMinutes: number;
  workSchedule: WorkSchedule;
}) {
  const status = machine?.status ?? "durus";
  const Icon = machine ? STATUS_ICON[status] : PowerOff;
  const tone = machine ? STATUS_TONE[status] : STATUS_TONE.durus;

  // Quick stats: per-step count
  const counts = {
    beklemede: jobs.filter((j) => j.job.status === "beklemede").length,
    ayar: jobs.filter((j) => j.job.status === "ayar").length,
    uretimde: jobs.filter((j) => j.job.status === "uretimde").length,
    tamamlandi: jobs.filter((j) => j.job.status === "tamamlandi").length,
    iptal: jobs.filter((j) => j.job.status === "iptal").length,
  };

  // Sort: in-progress first, then queue (by priority), then completed
  const sorted = [...jobs].sort((a, b) => {
    const order: Record<string, number> = {
      uretimde: 0,
      ayar: 1,
      beklemede: 2,
      tamamlandi: 3,
      iptal: 4,
    };
    const da = order[a.job.status] ?? 9;
    const dbb = order[b.job.status] ?? 9;
    if (da !== dbb) return da - dbb;
    if (a.job.priority !== b.job.priority) return b.job.priority - a.job.priority;
    return new Date(a.job.created_at).getTime() - new Date(b.job.created_at).getTime();
  });

  return (
    <div
      className={cn(
        "rounded-2xl border-2 bg-card overflow-hidden shadow-sm",
        tone.ring.replace("ring-", "border-"),
      )}
    >
      {/* Header */}
      <div className={cn("px-4 py-3 border-b flex items-center gap-3", tone.bg)}>
        <div
          className={cn(
            "size-10 rounded-xl flex items-center justify-center bg-card border-2 shadow-sm",
            tone.ring.replace("ring-", "border-"),
          )}
        >
          <Icon className={cn("size-5", tone.text)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-bold leading-tight">
              {machine?.name ?? "Atanmamış İşler"}
            </h3>
            {machine && (
              <Badge
                variant="outline"
                className={cn("text-[10px] gap-1 border", tone.bg, tone.text)}
              >
                <span className={cn("size-1.5 rounded-full", tone.dot)} />
                {MACHINE_STATUS_LABEL[status]}
              </Badge>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground flex items-center gap-3 flex-wrap mt-0.5">
            <span>
              <strong className="text-foreground">{jobs.length}</strong> iş
            </span>
            {counts.uretimde > 0 && (
              <span className="text-emerald-700 dark:text-emerald-300">
                ▶ {counts.uretimde} üretimde
              </span>
            )}
            {counts.ayar > 0 && (
              <span className="text-amber-700 dark:text-amber-300">
                ⚙ {counts.ayar} ayar
              </span>
            )}
            {counts.beklemede > 0 && (
              <span>⏳ {counts.beklemede} beklemede</span>
            )}
            {totalRemainingMinutes > 0 && (
              <span className="ml-auto font-mono">
                ~{formatMinutes(totalRemainingMinutes)} kalan
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-3 space-y-2">
        {sorted.length === 0 ? (
          <div className="text-center text-xs text-muted-foreground italic py-8">
            Bu makinede henüz iş yok.
          </div>
        ) : (
          sorted.map((d) => (
            <JobCard
              key={d.job.id}
              data={d}
              machines={machines}
              operators={operators}
              products={products}
              workSchedule={workSchedule}
            />
          ))
        )}
      </div>
    </div>
  );
}
