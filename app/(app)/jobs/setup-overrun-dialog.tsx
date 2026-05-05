"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  SETUP_OVERRUN_CATEGORY_LABEL,
  formatMinutes,
  type SetupOverrunCategory,
} from "@/lib/supabase/types";
import { recordSetupOverrunReason } from "../production/actions";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  jobId: string;
  jobLabel: string;
  machineId: string;
  /** Tahmini ayar süresi (dk). 0 ise "tahmin yok" gösterilir. */
  plannedMin: number;
  /** Ölçülen gerçek ayar süresi (dk). */
  actualMin: number;
}

const CATEGORIES: SetupOverrunCategory[] = [
  "program_hatasi",
  "mengene_fixture",
  "sifirlama_uzadi",
  "ilk_parca_kontrolu",
  "takim_eksik_degisti",
  "ariza_durus",
  "numune_takim_yoktu",
  "diger",
];

export function SetupOverrunDialog({
  open,
  onOpenChange,
  jobId,
  jobLabel,
  machineId,
  plannedMin,
  actualMin,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [category, setCategory] = useState<SetupOverrunCategory | null>(null);
  const [reason, setReason] = useState("");

  const overrun = Math.max(0, actualMin - plannedMin);

  function onSubmit() {
    if (!category) {
      toast.error("Bir sebep seç");
      return;
    }
    startTransition(async () => {
      const r = await recordSetupOverrunReason({
        machine_id: machineId,
        job_id: jobId,
        category,
        reason: reason.trim(),
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Ayar fazla süresi kaydedildi");
      onOpenChange(false);
      router.refresh();
    });
  }

  function onSkip() {
    // Operatör atlamak isterse kaydetmeden kapat. Production entry
    // setup_minutes/planned zaten yazıldı; sadece sebep boş kalır.
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="size-5 text-amber-500" />
            Ayar süresi tahmini aştı
          </DialogTitle>
          <DialogDescription>{jobLabel}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2 my-2">
          <Stat label="Tahmin" value={plannedMin} icon={Clock} />
          <Stat
            label="Gerçek"
            value={actualMin}
            icon={Clock}
            tone="emerald"
          />
          <Stat
            label="Fazla"
            value={overrun}
            icon={AlertTriangle}
            tone="amber"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-base font-semibold">Sebep nedir?</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={cn(
                  "text-left px-3 py-2 rounded-lg border text-sm transition",
                  category === c
                    ? "bg-primary/10 border-primary text-primary font-medium"
                    : "border-muted hover:border-primary/40 hover:bg-muted/40",
                )}
              >
                {SETUP_OVERRUN_CATEGORY_LABEL[c]}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium">
            Açıklama{" "}
            <span className="text-muted-foreground font-normal">
              (opsiyonel — detay yazabilirsin)
            </span>
          </Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Örn: G54 sıfırı kaymıştı, yeniden ayarladım"
            className="text-sm"
          />
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={onSkip}>
            Atla
          </Button>
          <Button
            type="button"
            disabled={pending || !category}
            onClick={onSubmit}
            className="gap-1.5"
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Sebebi Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "emerald" | "amber";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3 text-center",
        tone === "emerald" &&
          "bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300",
        tone === "amber" &&
          "bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-300",
      )}
    >
      <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider font-semibold opacity-70">
        <Icon className="size-3" />
        {label}
      </div>
      <div className="text-lg font-bold tabular-nums leading-tight mt-0.5">
        {formatMinutes(value)}
      </div>
    </div>
  );
}
