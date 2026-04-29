"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DecimalInput } from "@/components/ui/decimal-input";
import { toast } from "sonner";
import { Loader2, ArrowRight } from "lucide-react";
import { saveBulkMeasurements } from "./actions";
import { ResultBadge } from "./result-badge";
import {
  calculateQcResult,
  formatToleranceBand,
  type QualitySpec,
} from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

interface Props {
  jobId: string;
  specs: QualitySpec[];
  trigger: React.ReactNode;
}

// Increment a serial like "Numune-1" → "Numune-2", "1/100" → "2/100"
function incrementSerial(s: string): string {
  if (!s) return "";
  // pattern with trailing number: prefix + digits + optional suffix at very end
  const m = s.match(/^(.*?)(\d+)([^\d]*)$/);
  if (!m) return s;
  const prefix = m[1];
  const num = parseInt(m[2], 10) + 1;
  const suffix = m[3];
  return `${prefix}${num}${suffix}`;
}

export function BulkMeasurementDialog({ jobId, specs, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [serial, setSerial] = useState("Numune-1");
  const [values, setValues] = useState<Record<string, number | null>>({});
  // Bumped to remount DecimalInputs after a successful "next part" reset.
  const [resetNonce, setResetNonce] = useState(0);

  function reset() {
    setValues({});
    setResetNonce((n) => n + 1);
  }

  function nextPart() {
    setSerial((s) => incrementSerial(s));
    reset();
  }

  function onSubmit(advance = false) {
    const entries = Object.entries(values)
      .filter(([, v]) => v !== null && v !== undefined && Number.isFinite(v))
      .map(([spec_id, v]) => ({
        spec_id,
        measured_value: v as number,
      }));

    if (entries.length === 0) {
      toast.error("En az bir ölçüm gir.");
      return;
    }

    startTransition(async () => {
      const r = await saveBulkMeasurements({
        job_id: jobId,
        part_serial: serial,
        entries,
      });
      if (r.error) toast.error(r.error);
      else {
        toast.success(`${r.count} ölçüm kaydedildi`);
        if (advance) {
          nextPart();
        } else {
          setOpen(false);
        }
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          // reset on close
          setSerial("Numune-1");
          setValues({});
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Toplu Ölçüm</DialogTitle>
          <DialogDescription>
            Bu parça için tüm spec'leri sırayla gir. TAB tuşuyla bir sonraki kutuya
            atlayabilirsin. Kaydet → Sonraki ile bir sonraki parçaya geç.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="b-serial">Parça Seri / No</Label>
          <Input
            id="b-serial"
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
            placeholder="Numune-1, 1/100..."
            className="font-mono"
          />
        </div>

        <div className="rounded-lg border divide-y">
          {specs.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Önce bu iş için spec eklemelisin.
            </div>
          ) : (
            specs.map((s) => {
              const num = values[s.id];
              const hasVal = num !== null && num !== undefined && Number.isFinite(num);
              const result = hasVal
                ? calculateQcResult(
                    num as number,
                    Number(s.nominal_value),
                    Number(s.tolerance_plus),
                    Number(s.tolerance_minus),
                  )
                : null;
              return (
                <div
                  key={s.id}
                  className={cn(
                    "grid grid-cols-12 gap-2 items-center p-2.5 transition",
                    result === "ok" && "bg-emerald-500/5",
                    result === "sinirda" && "bg-amber-500/5",
                    result === "nok" && "bg-red-500/5",
                  )}
                >
                  <div className="col-span-1 text-center font-mono text-sm font-bold text-muted-foreground tabular-nums">
                    {s.bubble_no ?? "—"}
                  </div>
                  <div className="col-span-6 min-w-0">
                    <div className="text-sm font-medium truncate flex items-center gap-1.5">
                      {s.is_critical && (
                        <span
                          className="inline-block size-1.5 rounded-full bg-red-500 shrink-0"
                          title="Kritik"
                        />
                      )}
                      {s.description}
                    </div>
                    <div className="text-[11px] text-muted-foreground tabular-nums font-mono">
                      {Number(s.nominal_value).toFixed(3)} {s.unit} ·{" "}
                      {formatToleranceBand(
                        Number(s.tolerance_plus),
                        Number(s.tolerance_minus),
                      )}
                    </div>
                  </div>
                  <div className="col-span-3 flex justify-end">
                    <DecimalInput
                      key={`${s.id}-${resetNonce}`}
                      defaultValue={null}
                      onChange={(n) =>
                        setValues((p) => ({ ...p, [s.id]: n }))
                      }
                      decimals={3}
                      size="sm"
                      wholePlaceholder={String(
                        Math.trunc(Number(s.nominal_value)),
                      )}
                      ariaLabel={`Ölçüm ${s.description}`}
                    />
                  </div>
                  <div className="col-span-2 flex justify-end">
                    {result && <ResultBadge result={result} />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            İptal
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onSubmit(false)}
            disabled={pending}
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Kaydet ve Kapat
          </Button>
          <Button
            type="button"
            onClick={() => onSubmit(true)}
            disabled={pending || specs.length === 0}
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Kaydet ve Sonraki Parça
            <ArrowRight className="size-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
