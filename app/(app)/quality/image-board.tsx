"use client";

import { useMemo, useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DecimalInput } from "@/components/ui/decimal-input";
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
  Move,
  Circle,
  CircleOff,
  Check,
  PlusCircle,
  Palette,
  Maximize2,
  Shapes,
} from "lucide-react";
import {
  saveMeasurement,
  deleteSpec,
  deleteQualityDrawing,
  updateBubblePosition,
  updateBubbleColor,
  updateBubbleSize,
  updateBubbleShape,
} from "./actions";
import { SpecDialog } from "./spec-dialog";
import { ResultBadge } from "./result-badge";
import {
  BUBBLE_COLOR_PRESETS,
  BUBBLE_SIZE_PRESETS,
  BUBBLE_SHAPE_PRESETS,
  calculateQcResult,
  deviationPct,
  formatToleranceBand,
  formatToleranceRange,
  QC_RESULT_TONE,
  type QualitySpec,
  type QualityMeasurement,
  type QcResult,
  type BubbleSize,
  type BubbleShape,
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
  // Add mode: when true, clicking the image creates a new bubble (opens SpecDialog).
  // When false, clicks on the canvas just close any open panel — no popup spam.
  const [addMode, setAddMode] = useState(false);
  // Move mode: when true (after pressing "Taşı" in the bubble panel), the
  // selected bubble live-follows the cursor; clicking on the image commits
  // the new position and shows a brief ✓ tick flash. Esc cancels.
  const [moveMode, setMoveMode] = useState(false);
  // Live cursor position (normalized 0..1) while in move mode — drives the
  // ghost bubble preview. Null when cursor is outside the image.
  const [movePreview, setMovePreview] = useState<{ x: number; y: number } | null>(null);
  // Spec id to flash a green ✓ over after a successful move (auto-clears).
  const [tickFlashId, setTickFlashId] = useState<string | null>(null);
  // Optimistic position overrides — keeps a bubble at its newly placed
  // location while the server action + revalidate completes. Without this
  // there's a flicker where the bubble snaps back to the old position
  // for a frame between commit and the new server data arriving.
  const [localPositions, setLocalPositions] = useState<
    Map<string, { x: number; y: number }>
  >(new Map());
  const imageContainerRef = useRef<HTMLDivElement | null>(null);

  // Reset selection when drawing changes
  useEffect(() => {
    setSelectedSpecId(null);
    setPendingClick(null);
    setMoveMode(false);
  }, [activeId]);

  // Esc → cancel move mode / add mode / close selection
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (moveMode) setMoveMode(false);
      else if (addMode) setAddMode(false);
      else if (selectedSpecId) setSelectedSpecId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moveMode, addMode, selectedSpecId]);

  // Auto-clear the green ✓ flash after a short moment.
  useEffect(() => {
    if (!tickFlashId) return;
    const t = setTimeout(() => setTickFlashId(null), 1100);
    return () => clearTimeout(t);
  }, [tickFlashId]);

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

  function eventNormCoords(
    e: React.MouseEvent<HTMLDivElement>,
  ): { x: number; y: number } | null {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return null;
    return { x, y };
  }

  function onImageClick(e: React.MouseEvent<HTMLDivElement>) {
    const c = eventNormCoords(e);
    if (!c) return;

    // Move mode: commit new position for the selected bubble + tick flash
    if (moveMode && selectedSpecId) {
      const targetId = selectedSpecId;
      setLocalPositions((prev) => {
        const next = new Map(prev);
        next.set(targetId, c);
        return next;
      });
      setMoveMode(false);
      setMovePreview(null);
      setTickFlashId(targetId);
      void (async () => {
        const r = await updateBubblePosition(targetId, jobId, c.x, c.y);
        if (r.error) {
          toast.error(r.error);
          setLocalPositions((prev) => {
            const next = new Map(prev);
            next.delete(targetId);
            return next;
          });
        } else {
          router.refresh();
        }
      })();
      return;
    }

    // If a bubble is open, first click anywhere closes it (without spawning a new one)
    if (selectedSpecId) {
      setSelectedSpecId(null);
      return;
    }

    // Only open the new-bubble dialog when add mode is explicitly enabled.
    if (!addMode) return;
    setPendingClick(c);
    setAddMode(false);
  }

  // Live cursor preview while in move mode — drives the ghost bubble.
  function onContainerMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!moveMode || !selectedSpecId) return;
    const c = eventNormCoords(e);
    setMovePreview(c);
  }

  function onContainerMouseLeave() {
    if (moveMode) setMovePreview(null);
  }

  // Bubble click — just selects, opening the panel. (Drag-to-move removed.)
  function onBubbleClick(specId: string, e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    if (moveMode) {
      // In move mode, clicking another bubble switches the target.
      setSelectedSpecId(specId);
      return;
    }
    setSelectedSpecId(specId);
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
              variant={addMode ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setAddMode((v) => !v);
                setMoveMode(false);
                setSelectedSpecId(null);
              }}
              className="h-7 px-2.5 text-xs gap-1"
              title="Yeni balon ekleme modunu aç/kapat"
            >
              <PlusCircle className="size-3.5" />
              {addMode ? "Ekleme açık" : "Yeni Balon"}
            </Button>
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

        {/* Help banner — content depends on the active mode */}
        {moveMode ? (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
            <Move className="size-3.5 shrink-0" />
            <span>
              <strong>Taşıma modu aktif</strong> — balonun gideceği noktaya
              tıkla. Esc ile iptal.
            </span>
          </div>
        ) : addMode ? (
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
            <PlusCircle className="size-3.5 shrink-0" />
            <span>
              <strong>Ekleme modu aktif</strong> — yeni balon için resmin
              üstünde bir noktaya tıkla. Esc ile iptal.
            </span>
          </div>
        ) : (
          <div className="rounded-lg bg-blue-500/5 border border-blue-500/20 px-3 py-2 text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2">
            <Crosshair className="size-3.5 shrink-0" />
            <span>
              Yeni nokta için yukarıdan <strong>Yeni Balon</strong>’u aç ·
              Mevcut balona <strong>tıkla</strong>, alttan renk/taşı/ölçüm
            </span>
          </div>
        )}

        {/* Image with bubbles */}
        <div className="relative bg-zinc-50 dark:bg-zinc-100 rounded-lg overflow-hidden border">
          <div
            ref={imageContainerRef}
            onClick={onImageClick}
            onMouseMove={onContainerMouseMove}
            onMouseLeave={onContainerMouseLeave}
            className={cn(
              "relative select-none",
              moveMode || addMode ? "cursor-crosshair" : "cursor-default",
              selectedSpecId && !moveMode && !addMode && "cursor-pointer",
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
                // While the selected bubble is being live-moved, hide its real
                // position and show a ghost at the cursor instead.
                const liveMove =
                  moveMode && selectedSpecId === s.id && movePreview;
                let overrideX: number | null = null;
                let overrideY: number | null = null;
                if (liveMove) {
                  overrideX = movePreview!.x;
                  overrideY = movePreview!.y;
                } else {
                  const local = localPositions.get(s.id);
                  if (local) {
                    overrideX = local.x;
                    overrideY = local.y;
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
                    overrideX={overrideX}
                    overrideY={overrideY}
                    ghost={Boolean(liveMove)}
                    // While moving, no bubble should swallow the click —
                    // the click must reach the image container to commit
                    // the new position.
                    interactive={!moveMode}
                    showTickFlash={tickFlashId === s.id}
                    onClick={(e) => onBubbleClick(s.id, e)}
                  />
                );
              })}
          </div>
        </div>

        {/* Measurement entry bar OR coords helper.
            Hidden while move mode is active so the user focuses on picking
            the new point on the image. */}
        {selectedSpec && !moveMode ? (
          <MeasurementBar
            key={selectedSpec.id}
            spec={selectedSpec}
            measurements={measMap.get(selectedSpec.id) ?? []}
            onClose={() => setSelectedSpecId(null)}
            onSaved={() => router.refresh()}
            onMove={() => setMoveMode(true)}
          />
        ) : !moveMode && !addMode ? (
          <div className="text-[11px] text-muted-foreground text-center italic">
            Mevcut balona tıkla → renk / taşı / ölçüm. Yeni nokta için
            yukarıdan <strong>Yeni Balon</strong>’u aç.
          </div>
        ) : null}
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
  overrideX,
  overrideY,
  ghost,
  interactive,
  showTickFlash,
  onClick,
}: {
  spec: QualitySpec;
  result: QcResult | null;
  selected: boolean;
  showLabel: boolean;
  measurementCount: number;
  overrideX: number | null;
  overrideY: number | null;
  ghost: boolean;
  interactive: boolean;
  showTickFlash: boolean;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  // Color resolution: explicit override > result-derived > neutral default
  const customColor = spec.bubble_color;
  const usingCustom = Boolean(customColor && customColor !== "auto");

  const resultTone =
    result === "ok"
      ? "bg-emerald-500 text-white border-emerald-700"
      : result === "sinirda"
      ? "bg-amber-500 text-white border-amber-700"
      : result === "nok"
      ? "bg-red-500 text-white border-red-700"
      : "bg-white text-zinc-900 border-zinc-700";

  const hasOverride = overrideX !== null && overrideY !== null;
  const xPct = hasOverride ? overrideX! * 100 : (spec.bubble_x ?? 0) * 100;
  const yPct = hasOverride ? overrideY! * 100 : (spec.bubble_y ?? 0) * 100;

  // Resolve size + shape — fall back to defaults if DB row is older.
  const sizeDef =
    BUBBLE_SIZE_PRESETS.find((s) => s.key === spec.bubble_size) ??
    BUBBLE_SIZE_PRESETS[1]; // md
  const shapeDef =
    BUBBLE_SHAPE_PRESETS.find((s) => s.key === spec.bubble_shape) ??
    BUBBLE_SHAPE_PRESETS[0]; // circle

  // Triangle needs the number nudged down a touch — visually it sits in the
  // bottom 2/3 of its bounding box.
  const labelOffsetY = shapeDef.key === "triangle" ? "translate-y-[15%]" : "";

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        left: `${xPct}%`,
        top: `${yPct}%`,
        width: `${sizeDef.px}px`,
        height: `${sizeDef.px}px`,
        fontSize: `${sizeDef.fontPx}px`,
        // While in move mode, let pointer events fall through to the image
        // container so the click commits the new position.
        pointerEvents: interactive ? "auto" : "none",
        ...(shapeDef.borderRadius
          ? { borderRadius: shapeDef.borderRadius }
          : {}),
        ...(shapeDef.clipPath ? { clipPath: shapeDef.clipPath } : {}),
        ...(usingCustom
          ? {
              backgroundColor: customColor!,
              borderColor: customColor!,
              color: "white",
            }
          : {}),
      }}
      className={cn(
        "absolute -translate-x-1/2 -translate-y-1/2 z-10",
        // Border only renders for circle/square; clipPath shapes draw bg only.
        shapeDef.clipPath ? "" : "border-2",
        "font-bold tabular-nums shadow-md cursor-pointer",
        "flex items-center justify-center transition-transform",
        "hover:scale-110 hover:z-20",
        selected && "ring-4 ring-primary/40 scale-110 z-30",
        ghost && "opacity-70 z-40 shadow-lg ring-2 ring-amber-400",
        !usingCustom && resultTone,
      )}
      title={`#${spec.bubble_no ?? "?"} ${spec.description} · ${measurementCount} ölçüm`}
    >
      <span className={cn("leading-none pointer-events-none", labelOffsetY)}>
        {spec.bubble_no ?? "?"}
      </span>
      {showTickFlash && (
        <span
          className={cn(
            "absolute -top-2 -right-2 size-5 rounded-full border-2 border-white",
            "bg-emerald-500 text-white shadow-md flex items-center justify-center",
            "animate-in zoom-in-50 fade-in pointer-events-none",
          )}
          aria-hidden
        >
          <Check className="size-3 stroke-[3]" />
        </span>
      )}
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
  onMove,
}: {
  spec: QualitySpec;
  measurements: QualityMeasurement[];
  onClose: () => void;
  onSaved: () => void;
  onMove: () => void;
}) {
  const [partSerial, setPartSerial] = useState("");
  const [measValue, setMeasValue] = useState<number | null>(null);
  // Bumped after each successful save → DecimalInput remounts and clears.
  const [valueResetNonce, setValueResetNonce] = useState(0);
  const [pending, startTransition] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [pendingColor, startColor] = useTransition();
  const [pendingSize, startSize] = useTransition();
  const [pendingShape, startShape] = useTransition();
  // Which appearance popover (if any) is currently open
  const [openPanel, setOpenPanel] = useState<"color" | "size" | "shape" | null>(
    null,
  );
  const popRootRef = useRef<HTMLDivElement | null>(null);

  // Close popover on outside click
  useEffect(() => {
    if (!openPanel) return;
    function onDoc(e: MouseEvent) {
      const root = popRootRef.current;
      if (root && !root.contains(e.target as Node)) setOpenPanel(null);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [openPanel]);

  function pickColor(c: string | null) {
    startColor(async () => {
      const r = await updateBubbleColor(spec.id, spec.job_id, c);
      if (r.error) toast.error(r.error);
      else toast.success("Renk güncellendi");
    });
  }

  function pickSize(s: BubbleSize) {
    startSize(async () => {
      const r = await updateBubbleSize(spec.id, spec.job_id, s);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Boyut güncellendi");
        setOpenPanel(null);
      }
    });
  }

  function pickShape(sh: BubbleShape) {
    startShape(async () => {
      const r = await updateBubbleShape(spec.id, spec.job_id, sh);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Şekil güncellendi");
        setOpenPanel(null);
      }
    });
  }

  // Resolved appearance for live previews in popovers
  const currentSize = spec.bubble_size ?? "md";
  const currentShape = spec.bubble_shape ?? "circle";
  const currentColorKey = spec.bubble_color ?? "auto";

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

  const hasVal = measValue !== null && Number.isFinite(measValue);
  const num = hasVal ? (measValue as number) : 0;
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
        setMeasValue(null);
        setValueResetNonce((n) => n + 1);
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
        <div ref={popRootRef} className="flex items-center gap-1 shrink-0 relative">
          <Button
            variant="outline"
            size="sm"
            onClick={onMove}
            className="h-7 px-2.5 text-xs gap-1"
            title="Balonu yeni bir noktaya taşı (sonra resme tıkla)"
          >
            <Move className="size-3.5" />
            Taşı
          </Button>

          {/* Color popover trigger */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setOpenPanel((p) => (p === "color" ? null : "color"))
            }
            disabled={pendingColor}
            className="h-7 px-2 gap-1"
            title="Balon rengi"
          >
            {pendingColor ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <span
                className={cn(
                  "size-4 rounded-full border-2 border-zinc-400",
                  currentColorKey === "auto" &&
                    "bg-gradient-to-br from-emerald-500 via-amber-500 to-red-500",
                )}
                style={
                  currentColorKey !== "auto"
                    ? { backgroundColor: currentColorKey }
                    : undefined
                }
                aria-hidden
              />
            )}
            <Palette className="size-3.5" />
          </Button>

          {/* Size popover trigger */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOpenPanel((p) => (p === "size" ? null : "size"))}
            disabled={pendingSize}
            className="h-7 px-2 gap-1 text-[11px] font-bold uppercase"
            title="Balon boyutu"
          >
            {pendingSize ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Maximize2 className="size-3.5" />
            )}
            {currentSize}
          </Button>

          {/* Shape popover trigger */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setOpenPanel((p) => (p === "shape" ? null : "shape"))
            }
            disabled={pendingShape}
            className="h-7 px-2"
            title="Balon şekli"
          >
            {pendingShape ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Shapes className="size-4" />
            )}
          </Button>

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

          {/* ── Color popover ── */}
          {openPanel === "color" && (
            <div className="absolute right-0 top-9 z-30 w-64 rounded-lg border bg-card shadow-xl p-3 space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Renk
              </div>
              <div className="grid grid-cols-8 gap-1.5">
                {BUBBLE_COLOR_PRESETS.map((p) => {
                  const active = currentColorKey === p.key;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => pickColor(p.key === "auto" ? null : p.key)}
                      disabled={pendingColor}
                      className={cn(
                        "size-6 rounded-full border-2 flex items-center justify-center transition",
                        active
                          ? "ring-2 ring-primary scale-110 shadow"
                          : "hover:scale-110",
                        p.key === "auto"
                          ? "bg-gradient-to-br from-emerald-500 via-amber-500 to-red-500 border-zinc-300"
                          : p.bg + " border-zinc-700",
                      )}
                      title={p.name}
                      aria-label={p.name}
                    >
                      {active && (
                        <Check className="size-3 stroke-[3] text-white drop-shadow" />
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="border-t pt-2 flex items-center gap-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground shrink-0">
                  Özel
                </label>
                <input
                  type="color"
                  value={
                    currentColorKey !== "auto" && /^#/.test(currentColorKey)
                      ? currentColorKey
                      : "#3b82f6"
                  }
                  onChange={(e) => pickColor(e.target.value)}
                  disabled={pendingColor}
                  className="h-7 w-10 rounded border bg-transparent cursor-pointer p-0"
                />
                <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                  {currentColorKey === "auto" ? "auto" : currentColorKey}
                </span>
              </div>
            </div>
          )}

          {/* ── Size popover ── */}
          {openPanel === "size" && (
            <div className="absolute right-0 top-9 z-30 w-56 rounded-lg border bg-card shadow-xl p-3 space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Boyut
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {BUBBLE_SIZE_PRESETS.map((s) => {
                  const active = currentSize === s.key;
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => pickSize(s.key)}
                      disabled={pendingSize}
                      className={cn(
                        "h-16 rounded-md border flex flex-col items-center justify-center gap-1 transition",
                        active
                          ? "ring-2 ring-primary border-primary bg-primary/5"
                          : "hover:bg-muted",
                      )}
                      title={s.name}
                    >
                      <span
                        className="rounded-full bg-zinc-700 dark:bg-zinc-300 inline-block"
                        style={{
                          width: `${Math.min(s.px, 28)}px`,
                          height: `${Math.min(s.px, 28)}px`,
                        }}
                      />
                      <span className="text-[10px] font-bold uppercase tracking-wider">
                        {s.key}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Shape popover ── */}
          {openPanel === "shape" && (
            <div className="absolute right-0 top-9 z-30 w-64 rounded-lg border bg-card shadow-xl p-3 space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Şekil
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {BUBBLE_SHAPE_PRESETS.map((sh) => {
                  const active = currentShape === sh.key;
                  return (
                    <button
                      key={sh.key}
                      type="button"
                      onClick={() => pickShape(sh.key)}
                      disabled={pendingShape}
                      className={cn(
                        "h-16 rounded-md border flex flex-col items-center justify-center gap-1 transition",
                        active
                          ? "ring-2 ring-primary border-primary bg-primary/5"
                          : "hover:bg-muted",
                      )}
                      title={sh.name}
                    >
                      <span
                        className="bg-zinc-700 dark:bg-zinc-300 inline-block"
                        style={{
                          width: "22px",
                          height: "22px",
                          ...(sh.borderRadius
                            ? { borderRadius: sh.borderRadius }
                            : {}),
                          ...(sh.clipPath ? { clipPath: sh.clipPath } : {}),
                        }}
                      />
                      <span className="text-[10px] font-medium">
                        {sh.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
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
          <div className="mt-1">
            <DecimalInput
              key={`mb-meas-${spec.id}-${valueResetNonce}`}
              defaultValue={measValue}
              onChange={setMeasValue}
              decimals={3}
              autoFocus
              required
              wholePlaceholder={String(Math.trunc(Number(spec.nominal_value)))}
              ariaLabel="Ölçülen değer"
            />
          </div>
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
