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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { saveSpec, type SaveSpecInput } from "./actions";
import {
  QC_CHARACTERISTIC_EMOJI,
  QC_CHARACTERISTIC_LABEL,
  QC_TOLERANCE_PRESETS,
  QC_TOOL_PRESETS,
  type QcCharacteristicType,
  type QualitySpec,
} from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

interface Props {
  jobId: string;
  trigger: React.ReactNode;
  spec?: QualitySpec;
  defaultBubbleNo?: number;
}

const TYPES: QcCharacteristicType[] = [
  "boyut",
  "gdt",
  "yuzey",
  "sertlik",
  "agirlik",
  "diger",
];

export function SpecDialog({ jobId, trigger, spec, defaultBubbleNo }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [bubbleNo, setBubbleNo] = useState<string>(
    spec?.bubble_no?.toString() ?? defaultBubbleNo?.toString() ?? "",
  );
  const [type, setType] = useState<QcCharacteristicType>(
    spec?.characteristic_type ?? "boyut",
  );
  const [description, setDescription] = useState(spec?.description ?? "");
  const [nominal, setNominal] = useState<string>(
    spec ? String(spec.nominal_value) : "",
  );
  const [tolPlus, setTolPlus] = useState<string>(
    spec ? String(spec.tolerance_plus) : "0.05",
  );
  const [tolMinus, setTolMinus] = useState<string>(
    spec ? String(spec.tolerance_minus) : "0.05",
  );
  const [unit, setUnit] = useState(spec?.unit ?? "mm");
  const [tool, setTool] = useState(spec?.measurement_tool ?? "");
  const [critical, setCritical] = useState(spec?.is_critical ?? false);
  const [notes, setNotes] = useState(spec?.notes ?? "");

  function applyTolerancePreset(value: number) {
    setTolPlus(String(value));
    setTolMinus(String(value));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) {
      toast.error("Açıklama gerekli.");
      return;
    }
    const nominalNum = Number(nominal);
    const plusNum = Number(tolPlus);
    const minusNum = Number(tolMinus);
    if (!Number.isFinite(nominalNum)) {
      toast.error("Nominal değer geçersiz.");
      return;
    }
    if (!Number.isFinite(plusNum) || !Number.isFinite(minusNum)) {
      toast.error("Tolerans geçersiz.");
      return;
    }
    if (plusNum < 0 || minusNum < 0) {
      toast.error("Tolerans negatif olamaz (asimetrik için her ikisi de + girilir).");
      return;
    }

    const payload: SaveSpecInput = {
      id: spec?.id,
      job_id: jobId,
      bubble_no: bubbleNo === "" ? null : Number(bubbleNo),
      characteristic_type: type,
      description,
      nominal_value: nominalNum,
      tolerance_plus: plusNum,
      tolerance_minus: minusNum,
      unit,
      measurement_tool: tool,
      is_critical: critical,
      notes,
    };

    startTransition(async () => {
      const r = await saveSpec(payload);
      if (r.error) toast.error(r.error);
      else {
        toast.success(spec ? "Spec güncellendi" : "Spec eklendi");
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {spec ? "Kalite Spec'i Düzenle" : "Yeni Kalite Spec'i"}
          </DialogTitle>
          <DialogDescription>
            Teknik resimdeki bir ölçü için nominal değer, tolerans ve ölçüm aletini gir.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-3 space-y-1.5">
              <Label htmlFor="s-bubble">Balon No</Label>
              <Input
                id="s-bubble"
                type="number"
                min="0"
                value={bubbleNo}
                onChange={(e) => setBubbleNo(e.target.value)}
                placeholder="1, 2, 3…"
                className="tabular-nums"
              />
            </div>
            <div className="col-span-9 space-y-1.5">
              <Label htmlFor="s-type">Karakteristik Tipi</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as QcCharacteristicType)}
              >
                <SelectTrigger id="s-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      <span className="mr-1.5">{QC_CHARACTERISTIC_EMOJI[t]}</span>
                      {QC_CHARACTERISTIC_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="s-desc">Açıklama *</Label>
            <Input
              id="s-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Dış çap Ø50 / Toplam uzunluk / Yüzey pürüzlülüğü Ra"
              required
            />
          </div>

          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-4 space-y-1.5">
              <Label htmlFor="s-nominal">Nominal *</Label>
              <Input
                id="s-nominal"
                type="number"
                step="any"
                value={nominal}
                onChange={(e) => setNominal(e.target.value)}
                placeholder="50.00"
                required
                className="tabular-nums"
              />
            </div>
            <div className="col-span-3 space-y-1.5">
              <Label htmlFor="s-tplus">Tol +</Label>
              <Input
                id="s-tplus"
                type="number"
                step="any"
                min="0"
                value={tolPlus}
                onChange={(e) => setTolPlus(e.target.value)}
                className="tabular-nums"
              />
            </div>
            <div className="col-span-3 space-y-1.5">
              <Label htmlFor="s-tminus">Tol −</Label>
              <Input
                id="s-tminus"
                type="number"
                step="any"
                min="0"
                value={tolMinus}
                onChange={(e) => setTolMinus(e.target.value)}
                className="tabular-nums"
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="s-unit">Birim</Label>
              <Input
                id="s-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="mm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Hızlı Tolerans
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {QC_TOLERANCE_PRESETS.map((p) => (
                <Button
                  key={p.value}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs tabular-nums"
                  onClick={() => applyTolerancePreset(p.value)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="s-tool">Ölçüm Aleti</Label>
            <Input
              id="s-tool"
              list="qc-tool-presets"
              value={tool}
              onChange={(e) => setTool(e.target.value)}
              placeholder="Kumpas / Mikrometre / Mastar..."
            />
            <datalist id="qc-tool-presets">
              {QC_TOOL_PRESETS.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>

          <label
            className={cn(
              "flex items-start gap-2.5 rounded-lg border p-3 cursor-pointer transition",
              critical && "bg-red-500/5 border-red-500/40",
            )}
          >
            <Checkbox
              checked={critical}
              onCheckedChange={(v) => setCritical(v === true)}
              className="mt-0.5"
            />
            <div className="space-y-0.5">
              <div className="text-sm font-medium">Kritik Ölçü</div>
              <div className="text-xs text-muted-foreground">
                FAI / müşteri raporunda zorunlu olarak işaretlenir, NOK durumunda
                parça reddedilir.
              </div>
            </div>
          </label>

          <div className="space-y-1.5">
            <Label htmlFor="s-notes">Notlar</Label>
            <Textarea
              id="s-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Ölçüm yöntemi, referans yüzey vb."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              İptal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {spec ? "Kaydet" : "Ekle"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
