"use client";

import { useState, useMemo, useTransition } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { saveMeasurement } from "./actions";
import { ResultBadge } from "./result-badge";
import {
  calculateQcResult,
  formatToleranceBand,
  formatToleranceRange,
  QC_TOOL_PRESETS,
  type QualitySpec,
  type QualityMeasurement,
} from "@/lib/supabase/types";

interface Props {
  spec: QualitySpec;
  trigger: React.ReactNode;
  measurement?: QualityMeasurement;
  defaultPartSerial?: string;
}

export function MeasurementDialog({
  spec,
  trigger,
  measurement,
  defaultPartSerial,
}: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [serial, setSerial] = useState(
    measurement?.part_serial ?? defaultPartSerial ?? "",
  );
  const [value, setValue] = useState<number | null>(
    measurement ? Number(measurement.measured_value) : null,
  );
  const [tool, setTool] = useState(
    measurement?.measurement_tool ?? spec.measurement_tool ?? "",
  );
  const [notes, setNotes] = useState(measurement?.notes ?? "");

  const liveResult = useMemo(() => {
    if (value === null || !Number.isFinite(value)) return null;
    return {
      result: calculateQcResult(
        value,
        Number(spec.nominal_value),
        Number(spec.tolerance_plus),
        Number(spec.tolerance_minus),
      ),
      deviation: value - Number(spec.nominal_value),
    };
  }, [value, spec]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (value === null || !Number.isFinite(value)) {
      toast.error("Ölçülen değer geçersiz.");
      return;
    }
    const num = value;
    startTransition(async () => {
      const r = await saveMeasurement({
        id: measurement?.id,
        spec_id: spec.id,
        job_id: spec.job_id,
        part_serial: serial,
        measured_value: num,
        measurement_tool: tool,
        notes,
      });
      if (r.error) toast.error(r.error);
      else {
        toast.success(
          `Ölçüm kaydedildi · ${
            r.result === "ok" ? "OK" : r.result === "sinirda" ? "Sınırda" : "NOK"
          }`,
        );
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {measurement ? "Ölçüm Düzenle" : "Yeni Ölçüm"}
          </DialogTitle>
          <DialogDescription>
            {spec.bubble_no !== null && (
              <span className="font-mono mr-1">#{spec.bubble_no}</span>
            )}
            {spec.description}
          </DialogDescription>
        </DialogHeader>

        {/* Spec read-only summary */}
        <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-muted-foreground text-xs">Nominal</span>
            <span className="font-mono font-bold tabular-nums">
              {Number(spec.nominal_value).toFixed(3)} {spec.unit}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-muted-foreground text-xs">Tolerans</span>
            <span className="font-mono tabular-nums">
              {formatToleranceBand(
                Number(spec.tolerance_plus),
                Number(spec.tolerance_minus),
              )}{" "}
              {spec.unit}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-muted-foreground text-xs">Kabul Aralığı</span>
            <span className="font-mono text-xs tabular-nums">
              {formatToleranceRange(
                Number(spec.nominal_value),
                Number(spec.tolerance_plus),
                Number(spec.tolerance_minus),
                spec.unit,
              )}
            </span>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="m-serial">Parça Seri / No</Label>
              <Input
                id="m-serial"
                value={serial}
                onChange={(e) => setSerial(e.target.value)}
                placeholder="Numune-1, 1/100..."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-tool">Ölçüm Aleti</Label>
              <Input
                id="m-tool"
                list="qc-meas-tool-presets"
                value={tool}
                onChange={(e) => setTool(e.target.value)}
                placeholder="Kumpas..."
              />
              <datalist id="qc-meas-tool-presets">
                {QC_TOOL_PRESETS.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="m-value">Ölçülen Değer ({spec.unit}) *</Label>
            <div className="flex gap-2 items-center">
              <DecimalInput
                id="m-value"
                defaultValue={value}
                onChange={setValue}
                decimals={3}
                wholePlaceholder={String(Math.trunc(Number(spec.nominal_value)))}
                required
                autoFocus
                ariaLabel="Ölçülen değer"
              />
              <span className="text-xs text-muted-foreground">{spec.unit}</span>
              {liveResult && <ResultBadge result={liveResult.result} />}
            </div>
            {liveResult && (
              <p className="text-xs text-muted-foreground tabular-nums">
                Sapma:{" "}
                <span className="font-mono">
                  {liveResult.deviation >= 0 ? "+" : ""}
                  {liveResult.deviation.toFixed(4)} {spec.unit}
                </span>
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="m-notes">Not</Label>
            <Textarea
              id="m-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Ölçüm yönü, sıcaklık vb."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              İptal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {measurement ? "Kaydet" : "Ekle"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
