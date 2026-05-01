"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Trash2,
  TrendingUp,
  User,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import {
  calcEtaCalendarAware,
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
  type WorkSchedule,
} from "@/lib/supabase/types";
import { deleteJob, setJobStep } from "./actions";
import { completeJob } from "../production/actions";
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
    | "cleanup_time_minutes"
    | "setup_time_minutes"
    | "parts_per_setup"
  > | null;
  operator: Pick<Operator, "id" | "full_name"> | null;
  produced: number;
  todayProduced: number;
  todayScrap: number;
  todayDowntime: number;
  todaySetup: number;
}

export function JobCard({
  data,
  machines,
  operators,
  products,
  workSchedule,
}: {
  data: JobCardData;
  machines: import("@/lib/supabase/types").Machine[];
  operators: Operator[];
  products: Product[];
  workSchedule: WorkSchedule;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [completionOpen, setCompletionOpen] = useState(false);
  const { job, product, operator, produced } = data;

  const isCancelled = job.status === "iptal";
  const stepIdx = jobStepIndex(job.status);
  const tone = JOB_STATUS_TONE[job.status];

  const timeline = calcJobTimeline({
    quantity: job.quantity,
    produced,
    cycleMinutes: product?.cycle_time_minutes,
    cleanupMinutes: product?.cleanup_time_minutes,
    setupMinutes: product?.setup_time_minutes,
    partsPerSetup: product?.parts_per_setup,
  });

  // Calendar-aware ETA: skips lunch + weekends + non-work days.
  const eta =
    job.status === "ayar" || job.status === "uretimde"
      ? calcEtaCalendarAware(
          timeline.remainingTotalMinutes,
          workSchedule,
          new Date(),
        )
      : null;

  const due = job.due_date ? new Date(job.due_date) : null;
  const overdue =
    due &&
    job.status !== "tamamlandi" &&
    job.status !== "iptal" &&
    due.getTime() < Date.now();

  function move(next: JobStatus) {
    // "Tamamla" goes through the completion modal so we can ask for
    // scrap and stamp the production_entry — never call setJobStep
    // directly for the complete step.
    if (next === "tamamlandi") {
      setCompletionOpen(true);
      return;
    }
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

  function onDelete() {
    if (
      !confirm(
        `'${job.customer} – ${job.part_name}' işi silinsin mi? Geri alınamaz.`,
      )
    )
      return;
    startTransition(async () => {
      const r = await deleteJob(job.id);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("İş silindi");
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
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            disabled={pending}
            className="size-7 text-rose-600 hover:text-rose-600 hover:bg-rose-500/10"
            title="Sil"
          >
            <Trash2 className="size-3.5" />
          </Button>
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

      {/* Today's running entry summary — visible while work is in flight */}
      {!isCancelled &&
        (job.status === "ayar" || job.status === "uretimde") && (
          <div className="rounded-md bg-muted/40 border px-2 py-1.5 mb-2 flex items-center gap-2 text-[10px] flex-wrap">
            <span className="font-bold uppercase tracking-wider text-muted-foreground">
              Bugün:
            </span>
            <span className="tabular-nums">
              <span className="text-emerald-700 dark:text-emerald-300 font-semibold">
                {data.todayProduced}
              </span>{" "}
              parça
            </span>
            {data.todayScrap > 0 && (
              <span className="tabular-nums text-amber-700 dark:text-amber-300">
                · {data.todayScrap} fire
              </span>
            )}
            {data.todaySetup > 0 && (
              <span className="tabular-nums">
                · ⚙ {data.todaySetup}dk ayar
              </span>
            )}
            {data.todayDowntime > 0 && (
              <span className="tabular-nums text-rose-700 dark:text-rose-300">
                · ⏸ {data.todayDowntime}dk duruş
              </span>
            )}
          </div>
        )}

      {/* Bottom row: due date + operator + actions */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t flex-wrap">
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground min-w-0">
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

        <div className="flex items-center gap-1 ml-auto">
          {primaryAction && (
            <Button
              size="sm"
              onClick={() => move(primaryAction.next)}
              disabled={pending}
              className="h-7 px-2.5 text-[11px] gap-1"
            >
              {pending ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <primaryAction.icon className="size-3" />
              )}
              {primaryAction.label}
            </Button>
          )}
          {(job.status === "ayar" || job.status === "uretimde") && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => move("beklemede")}
              disabled={pending}
              className="h-7 px-2 text-[11px] gap-1"
              title="Beklemeye al"
            >
              <Pause className="size-3" />
            </Button>
          )}
        </div>
      </div>

      <CompletionDialog
        open={completionOpen}
        onOpenChange={setCompletionOpen}
        job={job}
        product={product}
        produced={produced}
        todayProduced={data.todayProduced}
        todayScrap={data.todayScrap}
        todaySetup={data.todaySetup}
        todayDowntime={data.todayDowntime}
        onSubmitted={() => {
          setCompletionOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}

/**
 * Completion dialog — user clicks "Tamamla" → we ask ONLY for scrap.
 * Everything else (produced, setup minutes, cycle minutes, downtime)
 * was tracked automatically. Produced is computed as quantity - scrap
 * which matches the user's mental model: "if I'm done, the rest are
 * good unless I tell you otherwise".
 *
 * The server completeJob action persists the production_entry, marks
 * the job tamamlandi, and stamps end_time.
 */
function CompletionDialog({
  open,
  onOpenChange,
  job,
  product,
  produced,
  todayProduced,
  todayScrap,
  todaySetup,
  todayDowntime,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  job: Job;
  product: JobCardData["product"];
  produced: number;
  todayProduced: number;
  todayScrap: number;
  todaySetup: number;
  todayDowntime: number;
  onSubmitted: () => void;
}) {
  const [scrap, setScrap] = useState("0");
  const [pending, startTransition] = useTransition();

  // Reset every time the dialog opens.
  useEffect(() => {
    if (open) setScrap("0");
  }, [open]);

  const remaining = Math.max(0, job.quantity - produced);
  const scrapNum = Math.max(0, Number(scrap) || 0);
  const finalProduced = Math.max(0, remaining - scrapNum);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!job.machine_id) {
      toast.error("Bu işin makinesi atanmamış — önce makine ata");
      return;
    }
    if (scrapNum > remaining) {
      toast.error(
        `Hurda kalan adetten (${remaining}) fazla olamaz. Düşür.`,
      );
      return;
    }
    startTransition(async () => {
      const r = await completeJob({
        job_id: job.id,
        scrap: scrapNum,
      });
      if ("error" in r && r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("İş tamamlandı, üretim formuna işlendi");
      onSubmitted();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>İşi Tamamla</DialogTitle>
          <DialogDescription>
            Sadece hurda adedini gir. Geri kalan otomatik hesaplanır ve
            bugünkü üretim formuna işlenir.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          {/* Auto-tracked summary */}
          <div className="rounded-md border bg-muted/30 px-3 py-2.5 space-y-1.5 text-xs">
            <div className="font-bold uppercase tracking-wider text-[10px] text-muted-foreground mb-1">
              Otomatik Takip
            </div>
            <SumRow label="Planlanan adet" value={job.quantity} />
            <SumRow label="Şimdiye kadar üretilen" value={produced} />
            <SumRow label="Bu vardiyada üretilen" value={todayProduced} />
            {todayScrap > 0 && (
              <SumRow label="Bu vardiyada hurda" value={todayScrap} />
            )}
            {todaySetup > 0 && (
              <SumRow
                label="Bu vardiyada ayar"
                value={`${todaySetup} dk`}
              />
            )}
            {todayDowntime > 0 && (
              <SumRow
                label="Bu vardiyada duruş"
                value={`${todayDowntime} dk`}
              />
            )}
            {product?.cycle_time_minutes != null && (
              <SumRow
                label="Cycle (parça başı)"
                value={`${product.cycle_time_minutes} dk`}
              />
            )}
          </div>

          {/* Scrap question */}
          <div className="space-y-1.5">
            <Label htmlFor="cd-scrap">Hurda Adet</Label>
            <Input
              id="cd-scrap"
              type="number"
              min={0}
              max={remaining}
              value={scrap}
              onChange={(e) => setScrap(e.target.value)}
              className="tabular-nums text-base h-10"
              autoFocus
            />
            <div className="text-[11px] text-muted-foreground tabular-nums">
              Bu kapanışta {remaining} parça kaldı. Hurdadan sonra{" "}
              <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                {finalProduced}
              </span>{" "}
              adet sağlam üretim eklenecek.
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              İptal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Tamamla
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SumRow({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-semibold tabular-nums">{value}</span>
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
