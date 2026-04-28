"use client";

import { useMemo, useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  ImageIcon,
  X,
  Loader2,
  Plus,
  Save,
  History,
  Crosshair,
  Eye,
  EyeOff,
  Trash2,
  Palette,
  Move,
  Circle,
  CircleOff,
} from "lucide-react";
import {
  saveMeasurement,
  deleteSpec,
  deleteQualityDrawing,
  updateBubblePosition,
  updateBubbleColor,
} from "./actions";
import { SpecDialog } from "./spec-dialog";
import { ResultBadge } from "./result-badge";
import {
  BUBBLE_COLOR_PRESETS,
  calculateQcResult,
  deviationPct,
  formatToleranceBand,
  formatToleranceRange,
  QC_RESULT_TONE,
  type QualitySpec,
  type QualityMeasurement,
  type QcResult,
} from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

interface DrawingForBoard {
  id: string;
  title: string;
  revision: string | null;
  signedUrl: string;
}

interface Props {
  jobId: string;
  drawings: DrawingForBoard[];
  specs: QualitySpec[];
  measurements: QualityMeasurement[];
}

type MeasMap = Map<string, QualityMeasurement[]>;

function buildMeasMap(measurements: QualityMeasurement[]): MeasMap {
  const m = new Map<string, QualityMeasurement[]>();
  for (const meas of measurements) {
    const arr = m.get(meas.spec_id) ?? [];
    arr.push(meas);
    m.set(meas.spec_id, arr);
  }
  return m;
}

// Aggregated bubble color: red if any nok, amber if any sınırda, emerald
// if there are ok measurements, neutral if no measurements yet.
function bubbleResult(measurements: QualityMeasurement[]): QcResult | null {
  if (measurements.length === 0) return null;
  if (measurements.some((m) => m.result === "nok")) return "nok";
  if (measurements.some((m) => m.result === "sinirda")) return "sinirda";
  return "ok";
}

export function QcImageBoard({ jobId, drawings, specs, measurements }: Props) {
  const router = useRouter();
  const [activeId, setActiveId] = useState<string | null>(drawings[0]?.id ?? null);
  const [pendingClick, setPendingClick] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [selectedSpecId, setSelectedSpecId] = useState<string | null>(null);
  const [showLabels, setShowLabels] = useState(true);
  const [showBubbles, setShowBubbles] = useState(true);
  const [deletingDrawing, startDeleteDrawing] = useTransition();
  // Drag state for repositioning bubbles. While a bubble is being dragged
  // we track its temporary normalized position; on release we persist it.
  const [dragging, setDragging] = useState<{
    specId: string;
    x: number;
    y: number;
  } | null>(null);
  // Optimistic position overrides — keeps a bubble at its newly dropped
  // location while the server action + revalidate completes. Without this,
  // there's a flicker where the bubble snaps back to the old position
  // for a frame between pointer-up and the new server data arriving.
  const [localPositions, setLocalPositions] = useState<
    Map<string, { x: number; y: number }>
  >(new Map());
  const draggingRef = useRef<{
    specId: string;
    moved: boolean;
    container: HTMLDivElement | null;
  } | null>(null);
  const imageContainerRef = useRef<HTMLDivElement | null>(null);

  // Reset selection when drawing changes
  useEffect(() => {
    setSelectedSpecId(null);
    setPendingClick(null);
  }, [activeId]);

  const measMap = useMemo(() => buildMeasMap(measurements), [measurements]);
  const drawing = drawings.find((d) => d.id === activeId);
  const specsForDrawing = specs.filter(
    (s) => s.drawing_id === activeId && s.bubble_x !== null && s.bubble_y !== null,
  );
  const selectedSpec = specsForDrawing.find((s) => s.id === selectedSpecId) ?? null;

  const nextBubbleNo = useMemo(() => {
    const used = specs.map((s) => s.bubble_no ?? 0);
    return used.length === 0 ? 1 : Math.max(...used) + 1;
  }, [specs]);

  function onImageClick(e: React.MouseEvent<HTMLDivElement>) {
    // Don't create a new bubble if a drag just happened
    if (draggingRef.current?.moved) {
      draggingRef.current = null;
      return;
    }
    // If a bubble is open, first click anywhere closes it
    if (selectedSpecId) {
      setSelectedSpecId(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    setPendingClick({ x, y });
  }

  // ── Drag-drop bubble repositioning ────────────────────────
  function onBubblePointerDown(specId: string, e: React.PointerEvent<HTMLButtonElement>) {
    e.stopPropagation();
    e.preventDefault();
    const container = imageContainerRef.current;
    if (!container) return;
    (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
    draggingRef.current = { specId, moved: false, container };
    const rect = container.getBoundingClientRect();
    setDragging({
      specId,
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    });
  }

  function onBubblePointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const drag = draggingRef.current;
    if (!drag) return;
    const rect = drag.container?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    drag.moved = true;
    setDragging({ specId: drag.specId, x, y });
  }

  async function onBubblePointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    const drag = draggingRef.current;
    if (!drag) return;
    try {
      (e.currentTarget as HTMLButtonElement).releasePointerCapture(e.pointerId);
    } catch {
      // safari sometimes throws if no capture
    }
    if (drag.moved && dragging) {
      // 1. Lock the new position locally BEFORE clearing dragging — bubble
      //    keeps its dropped spot, no snap-back flicker.
      const droppedX = dragging.x;
      const droppedY = dragging.y;
      setLocalPositions((prev) => {
        const next = new Map(prev);
        next.set(drag.specId, { x: droppedX, y: droppedY });
        return next;
      });
      setDragging(null);

      // 2. Persist to DB. router.refresh() will eventually sync server data.
      //    Local override stays until then; once spec.bubble_x matches, no
      //    visual change happens on refresh.
      const r = await updateBubblePosition(drag.specId, jobId, droppedX, droppedY);
      if (r.error) {
        toast.error(r.error);
        // rollback on failure
        setLocalPositions((prev) => {
          const next = new Map(prev);
          next.delete(drag.specId);
          return next;
        });
      } else {
        router.refresh();
      }
    } else if (!drag.moved) {
      setDragging(null);
      // Treat as click → select bubble
      setSelectedSpecId(drag.specId);
    } else {
      setDragging(null);
    }
    // Keep moved flag for one tick so onImageClick ignores trailing click
    setTimeout(() => {
      draggingRef.current = null;
    }, 0);
  }

  function onDeleteDrawing() {
    if (!drawing) return;
    const specCount = specsForDrawing.length;
    const measCount = specsForDrawing.reduce(
      (s, sp) => s + (measMap.get(sp.id)?.length ?? 0),
      0,
    );
    const msg = [
      `'${drawing.title}' resmi silinsin mi?`,
      "",
      `Bu resme bağlı ${specCount} balon ve ${measCount} ölçüm kalıcı olarak silinir.`,
      "Bu işlem geri alınamaz.",
    ].join("\n");
    if (!confirm(msg)) return;

    startDeleteDrawing(async () => {
      const r = await deleteQualityDrawing(drawing.id, jobId);
      if (r.error) {
        toast.error(r.error);
      } else {
        toast.success(
          `Resim silindi · ${r.removedSpecs ?? 0} balon ve ölçümleri temizlendi`,
        );
        // Switch to next drawing if any
        const remaining = drawings.filter((d) => d.id !== drawing.id);
        setActiveId(remaining[0]?.id ?? null);
        setSelectedSpecId(null);
        setPendingClick(null);
        router.refresh();
      }
    });
  }

  if (drawings.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 flex flex-col items-center justify-center text-center gap-3">
          <ImageIcon className="size-10 text-muted-foreground/40" />
          <div className="text-sm font-medium">Bağlı resim yok</div>
          <p className="text-xs text-muted-foreground max-w-sm">
            Önce <strong>Teknik Resimler</strong> sayfasından bu işe bir resim
            yükle. Sonra üzerine tıklayarak ölçü noktaları işaretleyebilirsin.
          </p>
          <Button asChild variant="outline">
            <a href="/drawings">Teknik Resimler</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-3 sm:p-4 space-y-3">
        {/* Drawing picker + actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {drawings.length > 1 ? (
            <Select value={activeId ?? ""} onValueChange={setActiveId}>
              <SelectTrigger className="h-8 w-auto min-w-[12rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {drawings.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.title}
                    {d.revision && (
                      <span className="text-muted-foreground ml-1.5">
                        · {d.revision}
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="font-semibold text-sm flex items-center gap-1.5">
              <ImageIcon className="size-4 text-muted-foreground" />
              {drawing?.title}
              {drawing?.revision && (
                <span className="text-muted-foreground">· {drawing.revision}</span>
              )}
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="outline" className="font-normal h-6 text-[10px]">
              {specsForDrawing.length} ölçü noktası
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowBubbles((v) => !v)}
              className="h-7 px-2 text-xs gap-1"
              title={showBubbles ? "Balonları gizle" : "Balonları göster"}
            >
              {showBubbles ? <Circle className="size-3.5" /> : <CircleOff className="size-3.5" />}
              Balonlar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowLabels((v) => !v)}
              className="h-7 px-2 text-xs gap-1"
            >
              {showLabels ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              Etiketler
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDeleteDrawing}
              disabled={deletingDrawing || !drawing}
              className="h-7 px-2 text-xs gap-1 text-red-700 hover:text-red-700 hover:bg-red-500/10"
              title="Bu resmi ve üzerindeki tüm balon/ölçümleri sil"
            >
              {deletingDrawing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
              Resmi Sil
            </Button>
          </div>
        </div>

        {/* Help banner */}
        <div className="rounded-lg bg-blue-500/5 border border-blue-500/20 px-3 py-2 text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2">
          <Crosshair className="size-3.5 shrink-0" />
          <span>
            Yeni nokta için resme <strong>tıkla</strong> · Mevcut balona{" "}
            <strong>tıkla</strong>, alttan ölçüm gir
          </span>
        </div>

        {/* Image with bubbles */}
        <div className="relative bg-zinc-50 dark:bg-zinc-100 rounded-lg overflow-hidden border">
          <div
            ref={imageContainerRef}
            onClick={onImageClick}
            className={cn(
              "relative cursor-crosshair select-none",
              selectedSpecId && "cursor-pointer",
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={drawing?.signedUrl}
              alt={drawing?.title || ""}
              className="w-full max-h-[70vh] object-contain block pointer-events-none"
              draggable={false}
            />
            {showBubbles &&
              specsForDrawing.map((s) => {
                const own = measMap.get(s.id) ?? [];
                const result = bubbleResult(own);
                const isSelected = s.id === selectedSpecId;
                const isDragging = dragging?.specId === s.id;
                // Position priority: live drag > local optimistic > server prop
                let dragX: number | null = null;
                let dragY: number | null = null;
                if (isDragging && dragging) {
                  dragX = dragging.x;
                  dragY = dragging.y;
                } else {
                  const local = localPositions.get(s.id);
                  if (local) {
                    dragX = local.x;
                    dragY = local.y;
                  }
                }
                return (
                  <Bubble
                    key={s.id}
                    spec={s}
                    result={result}
                    selected={isSelected}
                    showLabel={showLabels}
                    measurementCount={own.length}
                    dragX={dragX}
                    dragY={dragY}
                    isDragging={isDragging}
                    onPointerDown={(e) => onBubblePointerDown(s.id, e)}
                    onPointerMove={onBubblePointerMove}
                    onPointerUp={onBubblePointerUp}
                  />
                );
              })}
          </div>
        </div>

        {/* Measurement entry bar OR coords helper */}
        {selectedSpec ? (
          <MeasurementBar
            key={selectedSpec.id}
            spec={selectedSpec}
            measurements={measMap.get(selectedSpec.id) ?? []}
            onClose={() => setSelectedSpecId(null)}
            onSaved={() => router.refresh()}
          />
        ) : (
          <div className="text-[11px] text-muted-foreground text-center italic">
            Mevcut bir balona tıkla → ölçüm gir, ya da yeni nokta için resme
            tıkla.
          </div>
        )}
      </CardContent>

      {/* Controlled SpecDialog for new spec from image click */}
      {pendingClick && drawing && (
        <SpecDialog
          jobId={jobId}
          defaultDrawingId={drawing.id}
          defaultBubbleX={pendingClick.x}
          defaultBubbleY={pendingClick.y}
          defaultBubbleNo={nextBubbleNo}
          open
          onOpenChange={(v) => {
            if (!v) {
              setPendingClick(null);
              // server action revalidates; force client refresh too
              router.refresh();
            }
          }}
        />
      )}
    </Card>
  );
}

/* ────────────────────────────────────────────────────────── */

function Bubble({
  spec,
  result,
  selected,
  showLabel,
  measurementCount,
  dragX,
  dragY,
  isDragging,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  spec: QualitySpec;
  result: QcResult | null;
  selected: boolean;
  showLabel: boolean;
  measurementCount: number;
  dragX: number | null;
  dragY: number | null;
  isDragging: boolean;
  onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => void;
}) {
  // Color resolution: explicit override > result-derived > neutral default
  const customColor = spec.bubble_color;
  const usingCustom = customColor && customColor !== "auto";

  const resultTone =
    result === "ok"
      ? "bg-emerald-500 text-white border-emerald-700"
      : result === "sinirda"
      ? "bg-amber-500 text-white border-amber-700"
      : result === "nok"
      ? "bg-red-500 text-white border-red-700"
      : "bg-white text-zinc-900 border-zinc-700";

  // dragX/dragY captures BOTH live drag AND optimistic local override.
  // The `isDragging` flag is true only during the live drag (visual scale).
  const hasOverride = dragX !== null && dragY !== null;
  const xPct = hasOverride ? dragX! * 100 : (spec.bubble_x ?? 0) * 100;
  const yPct = hasOverride ? dragY! * 100 : (spec.bubble_y ?? 0) * 100;

  return (
    <button
      type="button"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onClick={(e) => e.stopPropagation()}
      style={{
        left: `${xPct}%`,
        top: `${yPct}%`,
        ...(usingCustom
          ? {
              backgroundColor: customColor!,
              borderColor: customColor!,
              color: "white",
            }
          : {}),
        cursor: isDragging ? "grabbing" : "grab",
        touchAction: "none",
      }}
      className={cn(
        "absolute -translate-x-1/2 -translate-y-1/2 z-10",
        "size-7 rounded-full border-2 font-bold text-xs tabular-nums shadow-md",
        "flex items-center justify-center transition-shadow",
        "hover:scale-125 hover:z-20",
        selected && "ring-4 ring-primary/40 scale-125 z-30",
        isDragging && "opacity-90 scale-125 z-40 shadow-lg",
        !usingCustom && resultTone,
      )}
      title={`#${spec.bubble_no ?? "?"} ${spec.description} · ${measurementCount} ölçüm · sürükle: konum değiştir`}
    >
      {spec.bubble_no ?? "?"}
      {showLabel && (
        <span
          className={cn(
            "absolute left-full ml-1.5 top-1/2 -translate-y-1/2 whitespace-nowrap",
            "px-1.5 py-0.5 rounded text-[10px] font-medium",
            "bg-zinc-900/90 text-white shadow pointer-events-none",
            selected ? "opacity-100" : "opacity-90",
          )}
        >
          {spec.description}
        </span>
      )}
    </button>
  );
}

/* ────────────────────────────────────────────────────────── */

function MeasurementBar({
  spec,
  measurements,
  onClose,
  onSaved,
}: {
  spec: QualitySpec;
  measurements: QualityMeasurement[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [partSerial, setPartSerial] = useState("");
  const [valueText, setValueText] = useState("");
  const [pending, startTransition] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [colorOpen, setColorOpen] = useState(false);
  const [pendingColor, startColor] = useTransition();

  function pickColor(c: string | null) {
    startColor(async () => {
      const r = await updateBubbleColor(spec.id, spec.job_id, c);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Renk güncellendi");
        setColorOpen(false);
      }
    });
  }

  function onDeleteSpec() {
    const msg = `#${spec.bubble_no ?? "?"} '${spec.description}' bu balon resimden silinsin mi?\n\n(Bu spec ve tüm ölçümleri kalıcı olarak silinir.)`;
    if (!confirm(msg)) return;
    startDelete(async () => {
      const r = await deleteSpec(spec.id, spec.job_id);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Balon silindi");
        onClose();
        onSaved();
      }
    });
  }

  const num = Number(valueText);
  const hasVal = valueText !== "" && Number.isFinite(num);
  const result = hasVal
    ? calculateQcResult(
        num,
        Number(spec.nominal_value),
        Number(spec.tolerance_plus),
        Number(spec.tolerance_minus),
      )
    : null;
  const dev = hasVal ? num - Number(spec.nominal_value) : 0;
  const devPct = hasVal ? deviationPct(num, Number(spec.nominal_value)) : 0;
  const direction =
    !hasVal || dev === 0 ? null : dev > 0 ? "fazla" : "eksik";

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasVal) {
      toast.error("Ölçülen değer geçersiz.");
      return;
    }
    startTransition(async () => {
      const r = await saveMeasurement({
        spec_id: spec.id,
        job_id: spec.job_id,
        part_serial: partSerial,
        measured_value: num,
      });
      if (r.error) toast.error(r.error);
      else {
        toast.success(
          `Ölçüm kaydedildi · ${
            r.result === "ok" ? "OK" : r.result === "sinirda" ? "Sınırda" : "NOK"
          }`,
        );
        setValueText("");
        onSaved();
      }
    });
  }

  return (
    <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="font-mono font-bold h-6">
              #{spec.bubble_no ?? "?"}
            </Badge>
            <span className="font-semibold">{spec.description}</span>
            {spec.is_critical && (
              <Badge variant="outline" className="bg-red-500/15 text-red-700 border-red-500/40 h-5 text-[10px]">
                KRİTİK
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 font-mono tabular-nums">
            Nominal:{" "}
            <span className="text-foreground font-bold">
              {Number(spec.nominal_value).toFixed(3)} {spec.unit}
            </span>
            {"  ·  Tol: "}
            <span className="text-foreground">
              {formatToleranceBand(
                Number(spec.tolerance_plus),
                Number(spec.tolerance_minus),
              )}
            </span>
            {"  ·  Aralık: "}
            <span className="text-foreground">
              {formatToleranceRange(
                Number(spec.nominal_value),
                Number(spec.tolerance_plus),
                Number(spec.tolerance_minus),
                spec.unit,
              )}
            </span>
            {spec.measurement_tool && (
              <>
                {"  ·  Alet: "}
                <span className="text-foreground">{spec.measurement_tool}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0 relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setColorOpen((v) => !v)}
            disabled={pendingColor}
            className="h-7 px-2"
            title="Balon rengi"
          >
            {pendingColor ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Palette className="size-4" />
            )}
          </Button>
          {colorOpen && (
            <div className="absolute right-16 top-8 z-20 rounded-lg border bg-card shadow-lg p-2 grid grid-cols-5 gap-1.5 min-w-[12rem]">
              {BUBBLE_COLOR_PRESETS.map((p) => {
                const active =
                  (spec.bubble_color ?? "auto") === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => pickColor(p.key === "auto" ? null : p.key)}
                    className={cn(
                      "size-7 rounded-full border-2 flex items-center justify-center transition",
                      active ? "ring-2 ring-primary scale-110" : "hover:scale-110",
                      p.key === "auto"
                        ? "bg-gradient-to-br from-emerald-500 via-amber-500 to-red-500 border-zinc-300"
                        : p.bg + " border-zinc-700",
                    )}
                    title={p.name}
                  />
                );
              })}
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onDeleteSpec}
            disabled={deleting}
            className="h-7 px-2 text-red-700 hover:text-red-700 hover:bg-red-500/10"
            title="Balonu (spec) sil"
          >
            {deleting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-7 px-2"
            title="Kapat"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      {/* Input row */}
      <form onSubmit={onSubmit} className="grid grid-cols-12 gap-2 items-end">
        <div className="col-span-12 sm:col-span-3">
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Parça Seri
          </label>
          <Input
            value={partSerial}
            onChange={(e) => setPartSerial(e.target.value)}
            placeholder="Numune-1"
            className="h-9 mt-1"
          />
        </div>
        <div className="col-span-12 sm:col-span-4">
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Ölçülen ({spec.unit})
          </label>
          <Input
            type="number"
            step="any"
            value={valueText}
            onChange={(e) => setValueText(e.target.value)}
            placeholder={Number(spec.nominal_value).toFixed(3)}
            autoFocus
            className="h-9 mt-1 tabular-nums text-base font-bold"
            required
          />
        </div>
        <div className="col-span-12 sm:col-span-3 flex items-end">
          {hasVal && result ? (
            <div className="rounded-md border bg-card p-2 w-full">
              <div className="flex items-center gap-2 mb-1">
                <ResultBadge result={result} />
                {direction && (
                  <span
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-wider",
                      direction === "fazla" ? "text-blue-700" : "text-orange-700",
                    )}
                  >
                    {direction}
                  </span>
                )}
              </div>
              <div className="text-[11px] tabular-nums font-mono">
                <span className="text-muted-foreground">Sapma: </span>
                <span className="font-bold">
                  {dev >= 0 ? "+" : ""}
                  {dev.toFixed(4)} {spec.unit}
                </span>
                <span className="text-muted-foreground"> ({devPct >= 0 ? "+" : ""}{devPct.toFixed(2)}%)</span>
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-muted-foreground italic">
              Değer gir → otomatik OK/NOK
            </div>
          )}
        </div>
        <div className="col-span-12 sm:col-span-2">
          <Button type="submit" disabled={pending || !hasVal} className="w-full">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Kaydet
          </Button>
        </div>
      </form>

      {/* Recent measurements */}
      {measurements.length > 0 && (
        <div className="border-t pt-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
            <History className="size-3" /> Son Ölçümler ({measurements.length})
          </div>
          <div className="flex gap-1.5 flex-wrap max-h-24 overflow-y-auto">
            {measurements.slice(0, 12).map((m) => {
              const d = Number(m.measured_value) - Number(spec.nominal_value);
              return (
                <div
                  key={m.id}
                  className={cn(
                    "rounded-md border px-2 py-1 text-[11px] tabular-nums font-mono flex items-center gap-1.5",
                    QC_RESULT_TONE[m.result],
                  )}
                  title={`${m.part_serial || "—"} · ${new Date(m.measured_at).toLocaleString("tr-TR")}`}
                >
                  <span className="font-semibold">
                    {Number(m.measured_value).toFixed(3)}
                  </span>
                  <span className="opacity-70">
                    ({d >= 0 ? "+" : ""}
                    {d.toFixed(3)})
                  </span>
                  {m.part_serial && (
                    <span className="opacity-60 normal-case font-sans text-[10px]">
                      · {m.part_serial}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {measurements.length === 0 && (
        <div className="border-t pt-2 text-[11px] text-muted-foreground italic flex items-center gap-1.5">
          <Plus className="size-3" /> Bu nokta için henüz ölçüm yok — ilk ölçümü gir.
        </div>
      )}
    </div>
  );
}
