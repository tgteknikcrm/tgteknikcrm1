"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  Hourglass,
  Loader2,
  Pause,
  Play,
  Settings2,
  TrendingUp,
  User,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import {
  calcJobTimeline,
  formatMinutes,
  JOB_STATUS_LABEL,
  JOB_STATUS_TONE,
  JOB_STEPS,
  jobStepIndex,
  type Job,
  type JobStatus,
  type Operator,
  type Product,
} from "@/lib/supabase/types";
import { setJobStep } from "./actions";
import { JobDialog } from "./job-dialog";
import { cn } from "@/lib/utils";

interface JobCardData {
  job: Job;
  product: Pick<
    Product,
    | "id"
    | "code"
    | "name"
    | "cycle_time_minutes"
    | "setup_time_minutes"
    | "parts_per_setup"
  > | null;
  operator: Pick<Operator, "id" | "full_name"> | null;
  produced: number;
}

export function JobCard({
  data,
  machines,
  operators,
  products,
}: {
  data: JobCardData;
  machines: import("@/lib/supabase/types").Machine[];
  operators: Operator[];
  products: Product[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { job, product, operator, produced } = data;

  const isCancelled = job.status === "iptal";
  const stepIdx = jobStepIndex(job.status);
  const tone = JOB_STATUS_TONE[job.status];

  const timeline = calcJobTimeline({
    quantity: job.quantity,
    produced,
    cycleMinutes: product?.cycle_time_minutes,
    setupMinutes: product?.setup_time_minutes,
    partsPerSetup: product?.parts_per_setup,
  });

  // Estimated finish wall-clock — only meaningful when work is in flight.
  const eta =
    job.status === "ayar" || job.status === "uretimde"
      ? new Date(Date.now() + timeline.remainingTotalMinutes * 60_000)
      : null;

  const due = job.due_date ? new Date(job.due_date) : null;
  const overdue =
    due &&
    job.status !== "tamamlandi" &&
    job.status !== "iptal" &&
    due.getTime() < Date.now();

  function move(next: JobStatus) {
    startTransition(async () => {
      const r = await setJobStep(job.id, next);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(`İş ${JOB_STATUS_LABEL[next]}`);
      router.refresh();
    });
  }

  // Friendly action affordance based on the current step.
  const primaryAction = (() => {
    if (isCancelled) return null;
    switch (job.status) {
      case "beklemede":
        return {
          label: "Ayara Başla",
          icon: Settings2,
          next: "ayar" as JobStatus,
        };
      case "ayar":
        return {
          label: "Üretime Başla",
          icon: Play,
          next: "uretimde" as JobStatus,
        };
      case "uretimde":
        return {
          label: "Tamamla",
          icon: CheckCircle2,
          next: "tamamlandi" as JobStatus,
        };
      case "tamamlandi":
        return null;
      default:
        return null;
    }
  })();

  return (
    <div
      className={cn(
        "group rounded-xl border bg-card p-3 transition shadow-sm hover:shadow-md",
        overdue && "border-rose-500/40",
        job.status === "tamamlandi" && "opacity-80",
        isCancelled && "opacity-60",
      )}
    >
      {/* Top row: title + actions */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            {job.job_no && (
              <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded">
                {job.job_no}
              </span>
            )}
            {product && (
              <Link
                href={`/products/${product.id}`}
                className="font-mono text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded hover:bg-primary/20 transition flex items-center gap-1"
              >
                {product.code}
                <ExternalLink className="size-2.5" />
              </Link>
            )}
            <span
              className={cn(
                "text-[10px] px-1.5 py-0.5 rounded font-medium",
                tone.bg,
                tone.text,
              )}
            >
              {JOB_STATUS_LABEL[job.status]}
            </span>
            {job.priority > 0 && (
              <Badge variant="outline" className="text-[9px] gap-0.5">
                ⚡ Öncelik {job.priority}
              </Badge>
            )}
            {overdue && (
              <Badge variant="destructive" className="text-[9px] gap-0.5">
                <AlertTriangle className="size-3" /> Gecikti
              </Badge>
            )}
          </div>
          <div className="text-sm font-semibold truncate leading-tight">
            {job.customer}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {job.part_name}
            {job.part_no && (
              <span className="ml-1 font-mono opacity-70">· {job.part_no}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="size-7"
            title="Kalite Kontrol"
          >
            <Link href={`/quality/${job.id}`}>
              <ClipboardCheck className="size-3.5" />
            </Link>
          </Button>
          <JobDialog
            job={job}
            machines={machines}
            operators={operators}
            products={products}
            trigger={
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                title="Düzenle"
              >
                Düzenle
              </Button>
            }
          />
        </div>
      </div>

      {/* Step indicator */}
      {!isCancelled && (
        <div className="grid grid-cols-4 gap-1 mb-3">
          {JOB_STEPS.map((s, i) => {
            const active = stepIdx === i;
            const done = stepIdx > i;
            return (
              <div
                key={s.key}
                className="flex flex-col items-center gap-1"
                title={s.label}
              >
                <div
                  className={cn(
                    "h-1.5 w-full rounded-full transition",
                    done && "bg-emerald-500",
                    active && "bg-primary animate-pulse",
                    !done && !active && "bg-muted",
                  )}
                />
                <span
                  className={cn(
                    "text-[9px] font-medium leading-none truncate w-full text-center",
                    active
                      ? "text-foreground"
                      : done
                        ? "text-emerald-700 dark:text-emerald-300"
                        : "text-muted-foreground",
                  )}
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
      {isCancelled && (
        <div className="rounded-md bg-rose-500/10 text-rose-700 dark:text-rose-300 text-xs font-medium px-2 py-1.5 mb-2 text-center">
          İptal Edildi
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
        <Stat
          icon={Wrench}
          label="Adet"
          value={job.quantity.toLocaleString("tr-TR")}
        />
        <Stat
          icon={TrendingUp}
          label="Üretilen"
          value={`${produced.toLocaleString("tr-TR")}`}
          tone={produced > 0 ? "emerald" : undefined}
          subtitle={`%${timeline.progressPct.toFixed(0)}`}
        />
        <Stat
          icon={Hourglass}
          label="Kalan"
          value={timeline.remaining.toLocaleString("tr-TR")}
        />
        <Stat
          icon={CalendarDays}
          label="Tahmini Bitiş"
          value={
            timeline.remainingTotalMinutes > 0
              ? formatMinutes(timeline.remainingTotalMinutes)
              : "—"
          }
          subtitle={
            eta
              ? eta.toLocaleString("tr-TR", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : undefined
          }
          tone={
            timeline.remainingTotalMinutes > 0 && eta && due && eta > due
              ? "rose"
              : "emerald"
          }
        />
      </div>

      {/* Progress bar */}
      {!isCancelled && job.quantity > 0 && (
        <div className="space-y-1 mb-2">
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                job.status === "tamamlandi"
                  ? "bg-emerald-500"
                  : "bg-gradient-to-r from-emerald-500 to-emerald-400",
              )}
              style={{ width: `${Math.min(100, timeline.progressPct)}%` }}
            />
          </div>
        </div>
      )}

      {/* Timeline math line */}
      {(timeline.totalMinutes > 0 || product) && !isCancelled && (
        <div className="text-[10px] text-muted-foreground mb-2 flex items-center gap-2 flex-wrap">
          {product?.cycle_time_minutes != null && (
            <span>
              Cycle:{" "}
              <span className="font-mono text-foreground">
                {product.cycle_time_minutes} dk
              </span>
            </span>
          )}
          {product?.setup_time_minutes != null && (
            <span>
              Ayar:{" "}
              <span className="font-mono text-foreground">
                {product.setup_time_minutes} dk × {timeline.setupsLeft}
              </span>
            </span>
          )}
          {product?.parts_per_setup && product.parts_per_setup > 1 && (
            <span>
              Bağlama:{" "}
              <span className="font-mono text-foreground">
                {product.parts_per_setup} adet
              </span>
            </span>
          )}
          {timeline.totalMinutes > 0 && (
            <span className="ml-auto">
              Toplam:{" "}
              <span className="font-mono text-foreground">
                {formatMinutes(timeline.totalMinutes)}
              </span>
            </span>
          )}
        </div>
      )}

      {/* Bottom row: due date + operator + primary action */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t">
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground min-w-0 flex-1">
          {due && (
            <span
              className={cn(
                "flex items-center gap-1",
                overdue && "text-rose-600 font-semibold",
              )}
            >
              <CalendarDays className="size-3" />
              {due.toLocaleDateString("tr-TR", {
                day: "numeric",
                month: "short",
              })}
            </span>
          )}
          {operator && (
            <span className="flex items-center gap-1.5 truncate">
              <Avatar className="size-4">
                <AvatarFallback className="text-[8px] font-bold">
                  {operator.full_name
                    .split(" ")
                    .map((p) => p[0])
                    .filter(Boolean)
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">{operator.full_name}</span>
            </span>
          )}
          {!operator && (
            <span className="flex items-center gap-1 italic">
              <User className="size-3" /> Atanmadı
            </span>
          )}
        </div>
        {primaryAction && (
          <Button
            size="sm"
            onClick={() => move(primaryAction.next)}
            disabled={pending}
            className="h-7 px-2.5 text-[11px] gap-1 shrink-0"
          >
            {pending ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <primaryAction.icon className="size-3" />
            )}
            {primaryAction.label}
          </Button>
        )}
        {job.status === "ayar" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => move("beklemede")}
            disabled={pending}
            className="h-7 px-2 text-[11px] gap-1 shrink-0"
            title="Bekleme listesine geri al"
          >
            <Pause className="size-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  subtitle,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subtitle?: string;
  tone?: "emerald" | "rose" | "amber";
}) {
  const toneClass =
    tone === "emerald"
      ? "text-emerald-700 dark:text-emerald-300"
      : tone === "rose"
        ? "text-rose-700 dark:text-rose-300"
        : tone === "amber"
          ? "text-amber-700 dark:text-amber-300"
          : "";
  return (
    <div className="rounded-md bg-muted/40 px-2 py-1.5 min-w-0">
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground font-bold">
        <Icon className="size-2.5" />
        {label}
      </div>
      <div className={cn("text-sm font-semibold tabular-nums truncate", toneClass)}>
        {value}
      </div>
      {subtitle && (
        <div className="text-[9px] text-muted-foreground tabular-nums">
          {subtitle}
        </div>
      )}
    </div>
  );
}
