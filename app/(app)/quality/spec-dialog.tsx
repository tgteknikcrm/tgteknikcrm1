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
  trigger?: React.ReactNode;
  spec?: QualitySpec;
  defaultBubbleNo?: number;
  // Pre-link to a drawing + position (used by the visual image board flow)
  defaultDrawingId?: string;
  defaultBubbleX?: number;
  defaultBubbleY?: number;
  // Controlled-open support so the image board can drive this dialog
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const TYPES: QcCharacteristicType[] = [
  "boyut",
  "gdt",
  "yuzey",
  "sertlik",
  "agirlik",
  "diger",
];

export function SpecDialog({
  jobId,
  trigger,
  spec,
  defaultBubbleNo,
  defaultDrawingId,
  defaultBubbleX,
  defaultBubbleY,
  open: controlledOpen,
  onOpenChange,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (v: boolean) => {
    if (!isControlled) setInternalOpen(v);
    onOpenChange?.(v);
  };
  const [pending, startTransition] = useTransition();

  const [bubbleNo, setBubbleNo] = useState<string>(
    spec?.bubble_no?.toString() ?? defaultBubbleNo?.toString() ?? "",
  );
  const [type, setType] = useState<QcCharacteristicType>(
    spec?.characteristic_type ?? "boyut",
  );
  const [description, setDescription] = useState(spec?.description ?? "");
  const [nominal, setNominal] = useState<number | null>(
    spec ? Number(spec.nominal_value) : null,
  );
  const [tolPlus, setTolPlus] = useState<number | null>(
    spec ? Number(spec.tolerance_plus) : 0.05,
  );
  const [tolMinus, setTolMinus] = useState<number | null>(
    spec ? Number(spec.tolerance_minus) : 0.05,
  );
  // Bumped each time we apply a preset, so DecimalInput remounts and shows
  // the new value (it is uncontrolled and keyed by this nonce).
  const [tolPresetNonce, setTolPresetNonce] = useState(0);
  const [unit, setUnit] = useState(spec?.unit ?? "mm");
  const [tool, setTool] = useState(spec?.measurement_tool ?? "");
  const [critical, setCritical] = useState(spec?.is_critical ?? false);
  const [notes, setNotes] = useState(spec?.notes ?? "");

  function applyTolerancePreset(value: number) {
    setTolPlus(value);
    setTolMinus(value);
    setTolPresetNonce((n) => n + 1);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) {
      toast.error("Açıklama gerekli.");
      return;
    }
    if (nominal === null || !Number.isFinite(nominal)) {
      toast.error("Nominal değer geçersiz.");
      return;
    }
    if (
      tolPlus === null ||
      tolMinus === null ||
      !Number.isFinite(tolPlus) ||
      !Number.isFinite(tolMinus)
    ) {
      toast.error("Tolerans geçersiz.");
      return;
    }
    if (tolPlus < 0 || tolMinus < 0) {
      toast.error("Tolerans negatif olamaz (asimetrik için her ikisi de + girilir).");
      return;
    }
    const nominalNum = nominal;
    const plusNum = tolPlus;
    const minusNum = tolMinus;

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
      drawing_id: spec?.drawing_id ?? defaultDrawingId ?? null,
      bubble_x: spec?.bubble_x ?? defaultBubbleX ?? null,
      bubble_y: spec?.bubble_y ?? defaultBubbleY ?? null,
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
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
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

          {/* Nominal + Birim — daha geniş, sıkışmadan */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_7rem] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="s-nominal" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Nominal *
              </Label>
              <DecimalInput
                id="s-nominal"
                defaultValue={nominal}
                onChange={setNominal}
                decimals={3}
                wholePlaceholder="50"
                required
                ariaLabel="Nominal değer"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-unit" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Birim
              </Label>
              <Input
                id="s-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="mm"
                className="font-mono"
              />
            </div>
          </div>

          {/* Tolerans satırı — Tol+ / Tol- yan yana, eşit genişlikte */}
          <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <span className="text-base leading-none">+</span> Üst Tolerans
                </Label>
                <DecimalInput
                  key={`tol-plus-${tolPresetNonce}`}
                  defaultValue={tolPlus}
                  onChange={setTolPlus}
                  decimals={3}
                  min={0}
                  ariaLabel="Üst tolerans"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 flex items-center gap-1">
                  <span className="text-base leading-none">−</span> Alt Tolerans
                </Label>
                <DecimalInput
                  key={`tol-minus-${tolPresetNonce}`}
                  defaultValue={tolMinus}
                  onChange={setTolMinus}
                  decimals={3}
                  min={0}
                  ariaLabel="Alt tolerans"
                />
              </div>
            </div>

            <div className="space-y-1.5 pt-1 border-t border-border/40">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Hızlı Tolerans
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {QC_TOLERANCE_PRESETS.map((p) => (
                  <Button
                    key={p.value}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2.5 text-xs tabular-nums hover:scale-[1.04] transition"
                    onClick={() => applyTolerancePreset(p.value)}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
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
