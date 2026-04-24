"use client";

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useTransition,
} from "react";
import * as fabric from "fabric";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MousePointer2,
  Type,
  Square,
  Circle as CircleIcon,
  ArrowUpRight,
  Pencil,
  Hash,
  CaseUpper,
  Trash2,
  Undo2,
  Redo2,
  Save,
  Loader2,
  CheckCheck,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { saveAnnotations } from "./actions";

type Tool =
  | "select"
  | "text"
  | "rect"
  | "circle"
  | "arrow"
  | "draw"
  | "number"
  | "letter";

const PALETTE = [
  "#dc2626", // red
  "#f59e0b", // amber
  "#16a34a", // green
  "#2563eb", // blue
  "#7c3aed", // violet
  "#000000", // black
  "#ffffff", // white
];

const FONTS = [
  { value: "Inter", label: "Inter (Sans)" },
  { value: "Arial", label: "Arial" },
  { value: "Times New Roman", label: "Times" },
  { value: "Courier New", label: "Courier (Mono)" },
  { value: "Comic Sans MS", label: "Comic Sans" },
];

interface Props {
  imageUrl: string;
  drawingId: string;
  initialAnnotations?: unknown | null;
  onSaved?: () => void;
}

export function AnnotationEditor({
  imageUrl,
  drawingId,
  initialAnnotations,
  onSaved,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const undoStack = useRef<string[]>([]);
  const redoStack = useRef<string[]>([]);
  const isRestoringRef = useRef(false);

  const [tool, setTool] = useState<Tool>("select");
  const [color, setColor] = useState<string>("#dc2626");
  const [width, setWidth] = useState<number>(3);
  const [fontSize, setFontSize] = useState<number>(24);
  const [fontFamily, setFontFamily] = useState<string>("Inter");
  const [numberCounter, setNumberCounter] = useState<number>(1);
  const [letterCounter, setLetterCounter] = useState<number>(0);
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  // Snapshot helpers ---------------------------------------------------------
  const pushSnapshot = useCallback(() => {
    if (!fabricRef.current || isRestoringRef.current) return;
    const json = JSON.stringify(fabricRef.current.toJSON());
    undoStack.current.push(json);
    if (undoStack.current.length > 50) undoStack.current.shift();
    redoStack.current = [];
  }, []);

  // Load image as canvas background, restore annotations -------------------
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      isDrawingMode: false,
      preserveObjectStacking: true,
      backgroundColor: "#f8fafc",
    });
    fabricRef.current = canvas;

    let cancelled = false;

    const init = async () => {
      try {
        const img = await fabric.FabricImage.fromURL(imageUrl, {
          crossOrigin: "anonymous",
        });
        if (cancelled) return;

        const containerW = containerRef.current!.clientWidth;
        const maxW = Math.min(containerW - 4, 1400);
        const maxH = Math.min(window.innerHeight - 320, 900);
        const scale = Math.min(
          maxW / (img.width ?? 1),
          maxH / (img.height ?? 1),
          1,
        );
        const w = (img.width ?? 800) * scale;
        const h = (img.height ?? 600) * scale;

        canvas.setDimensions({ width: w, height: h });
        img.scale(scale);
        img.set({ selectable: false, evented: false, hoverCursor: "default" });
        canvas.backgroundImage = img;

        if (initialAnnotations) {
          isRestoringRef.current = true;
          await canvas.loadFromJSON(initialAnnotations as object);
          // Restoring loadFromJSON overwrites backgroundImage; reapply.
          canvas.backgroundImage = img;
          canvas.renderAll();
          isRestoringRef.current = false;

          // Bump counters past existing numbered/lettered labels
          let maxN = 0;
          let maxL = -1;
          canvas.getObjects().forEach((o) => {
            const meta = (o as fabric.Object & { data?: { kind?: string; n?: number; l?: number } }).data;
            if (meta?.kind === "number" && typeof meta.n === "number") {
              maxN = Math.max(maxN, meta.n);
            }
            if (meta?.kind === "letter" && typeof meta.l === "number") {
              maxL = Math.max(maxL, meta.l);
            }
          });
          setNumberCounter(maxN + 1);
          setLetterCounter(maxL + 1);
        } else {
          canvas.renderAll();
        }

        pushSnapshot();
      } catch (e) {
        console.error("Editor init failed", e);
        toast.error("Resim yüklenemedi");
      }
    };

    init();

    canvas.on("object:added", () => pushSnapshot());
    canvas.on("object:modified", () => pushSnapshot());
    canvas.on("object:removed", () => pushSnapshot());

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        const active = canvas.getActiveObjects();
        if (active.length) {
          active.forEach((o) => canvas.remove(o));
          canvas.discardActiveObject();
          canvas.requestRenderAll();
        }
      }
      if (e.key === "Escape") {
        canvas.discardActiveObject();
        canvas.requestRenderAll();
        setTool("select");
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      cancelled = true;
      window.removeEventListener("keydown", onKey);
      canvas.dispose();
      fabricRef.current = null;
      undoStack.current = [];
      redoStack.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl]);

  // Activate the chosen tool -----------------------------------------------
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.isDrawingMode = tool === "draw";
    canvas.selection = tool === "select";
    if (tool === "draw") {
      const brush = new fabric.PencilBrush(canvas);
      brush.color = color;
      brush.width = width;
      canvas.freeDrawingBrush = brush;
    }
    canvas.defaultCursor = tool === "select" ? "default" : "crosshair";
    canvas.hoverCursor = tool === "select" ? "move" : "crosshair";
  }, [tool, color, width]);

  // Click-to-place handler for shape tools ---------------------------------
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const handler = (opt: fabric.TPointerEventInfo) => {
      if (tool === "select" || tool === "draw") return;
      const p = canvas.getViewportPoint(opt.e);
      let obj: fabric.Object | null = null;

      if (tool === "rect") {
        obj = new fabric.Rect({
          left: p.x - 50,
          top: p.y - 30,
          width: 100,
          height: 60,
          fill: "transparent",
          stroke: color,
          strokeWidth: width,
          rx: 2,
          ry: 2,
        });
      } else if (tool === "circle") {
        obj = new fabric.Circle({
          left: p.x - 40,
          top: p.y - 40,
          radius: 40,
          fill: "transparent",
          stroke: color,
          strokeWidth: width,
        });
      } else if (tool === "arrow") {
        obj = makeArrow(p.x, p.y, p.x + 120, p.y, color, width);
      } else if (tool === "text") {
        obj = new fabric.IText("Yazı", {
          left: p.x,
          top: p.y,
          fontSize,
          fontFamily,
          fill: color,
        });
        canvas.add(obj);
        canvas.setActiveObject(obj);
        (obj as fabric.IText).enterEditing();
        (obj as fabric.IText).selectAll();
        canvas.requestRenderAll();
        setTool("select");
        return;
      } else if (tool === "number") {
        obj = makeBadge(String(numberCounter), p.x, p.y, color, fontFamily);
        (obj as fabric.Object & { data?: object }).data = {
          kind: "number",
          n: numberCounter,
        };
        setNumberCounter((n) => n + 1);
      } else if (tool === "letter") {
        const letter = String.fromCharCode(65 + (letterCounter % 26));
        obj = makeBadge(letter, p.x, p.y, color, fontFamily);
        (obj as fabric.Object & { data?: object }).data = {
          kind: "letter",
          l: letterCounter,
        };
        setLetterCounter((l) => l + 1);
      }

      if (obj) {
        canvas.add(obj);
        canvas.setActiveObject(obj);
        canvas.requestRenderAll();
        setTool("select");
      }
    };

    canvas.on("mouse:down", handler);
    return () => {
      canvas.off("mouse:down", handler);
    };
  }, [tool, color, width, fontSize, fontFamily, numberCounter, letterCounter]);

  // Operations -------------------------------------------------------------
  function undo() {
    const canvas = fabricRef.current;
    if (!canvas || undoStack.current.length < 2) return;
    const current = undoStack.current.pop()!;
    redoStack.current.push(current);
    const prev = undoStack.current[undoStack.current.length - 1];
    isRestoringRef.current = true;
    canvas.loadFromJSON(JSON.parse(prev)).then(() => {
      canvas.renderAll();
      isRestoringRef.current = false;
    });
  }

  function redo() {
    const canvas = fabricRef.current;
    if (!canvas || redoStack.current.length === 0) return;
    const next = redoStack.current.pop()!;
    undoStack.current.push(next);
    isRestoringRef.current = true;
    canvas.loadFromJSON(JSON.parse(next)).then(() => {
      canvas.renderAll();
      isRestoringRef.current = false;
    });
  }

  function clearSelected() {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObjects();
    if (active.length === 0) {
      toast.message("Önce bir nesne seç.");
      return;
    }
    active.forEach((o) => canvas.remove(o));
    canvas.discardActiveObject();
    canvas.requestRenderAll();
  }

  function clearAll() {
    const canvas = fabricRef.current;
    if (!canvas) return;
    if (!confirm("Tüm açıklamalar silinsin mi?")) return;
    const bg = canvas.backgroundImage;
    canvas.clear();
    canvas.backgroundImage = bg;
    canvas.renderAll();
  }

  function save() {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const json = canvas.toJSON();
    startTransition(async () => {
      const r = await saveAnnotations(drawingId, json);
      if (r.error) {
        toast.error(r.error);
      } else {
        toast.success("Açıklamalar kaydedildi");
        setSavedAt(new Date());
        onSaved?.();
      }
    });
  }

  return (
    <div className="space-y-3">
      <Toolbar
        tool={tool}
        setTool={setTool}
        color={color}
        setColor={setColor}
        width={width}
        setWidth={setWidth}
        fontSize={fontSize}
        setFontSize={setFontSize}
        fontFamily={fontFamily}
        setFontFamily={setFontFamily}
        onUndo={undo}
        onRedo={redo}
        onDeleteSelected={clearSelected}
        onClearAll={clearAll}
      />

      <div
        ref={containerRef}
        className="rounded-lg border bg-muted/30 overflow-auto p-2 flex justify-center"
      >
        <canvas ref={canvasRef} />
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          {savedAt
            ? `Son kayıt: ${savedAt.toLocaleTimeString("tr-TR")}`
            : "Henüz kaydedilmedi"}
          <span className="ml-3 opacity-70">
            Seçim modunda Delete/Backspace ile sil. Esc seçimi iptal eder.
          </span>
        </div>
        <Button onClick={save} disabled={pending} className="gap-1.5">
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : savedAt ? (
            <CheckCheck className="size-4" />
          ) : (
            <Save className="size-4" />
          )}
          Kaydet
        </Button>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------
// Toolbar
// -------------------------------------------------------------------------
function Toolbar(props: {
  tool: Tool;
  setTool: (t: Tool) => void;
  color: string;
  setColor: (c: string) => void;
  width: number;
  setWidth: (w: number) => void;
  fontSize: number;
  setFontSize: (n: number) => void;
  fontFamily: string;
  setFontFamily: (f: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onDeleteSelected: () => void;
  onClearAll: () => void;
}) {
  const tools: { id: Tool; icon: typeof MousePointer2; label: string }[] = [
    { id: "select", icon: MousePointer2, label: "Seç" },
    { id: "text", icon: Type, label: "Yazı" },
    { id: "rect", icon: Square, label: "Kare" },
    { id: "circle", icon: CircleIcon, label: "Daire" },
    { id: "arrow", icon: ArrowUpRight, label: "Ok" },
    { id: "draw", icon: Pencil, label: "Çiz" },
    { id: "number", icon: Hash, label: "Numara" },
    { id: "letter", icon: CaseUpper, label: "Harf" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 p-2 rounded-lg border bg-background">
      <div className="flex flex-wrap gap-1">
        {tools.map((t) => (
          <Button
            key={t.id}
            type="button"
            variant={props.tool === t.id ? "default" : "outline"}
            size="sm"
            onClick={() => props.setTool(t.id)}
            className="h-9 gap-1.5"
            title={t.label}
          >
            <t.icon className="size-4" />
            <span className="hidden md:inline">{t.label}</span>
          </Button>
        ))}
      </div>

      <div className="h-6 w-px bg-border mx-1" />

      <div className="flex items-center gap-1">
        {PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => props.setColor(c)}
            className={cn(
              "size-7 rounded-full border-2 transition",
              props.color === c
                ? "border-foreground scale-110"
                : "border-border hover:scale-105",
            )}
            style={{ background: c }}
            title={c}
          />
        ))}
        <Input
          type="color"
          value={props.color}
          onChange={(e) => props.setColor(e.target.value)}
          className="h-7 w-10 p-0.5 ml-1"
          title="Özel renk"
        />
      </div>

      <div className="h-6 w-px bg-border mx-1" />

      <div className="flex items-center gap-2">
        <Label htmlFor="aw" className="text-xs text-muted-foreground">
          Kalınlık
        </Label>
        <input
          id="aw"
          type="range"
          min={1}
          max={20}
          value={props.width}
          onChange={(e) => props.setWidth(Number(e.target.value))}
          className="w-20"
        />
        <span className="text-xs tabular-nums w-6 text-right">{props.width}</span>
      </div>

      <div className="h-6 w-px bg-border mx-1" />

      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground">Yazı</Label>
        <Select value={props.fontFamily} onValueChange={props.setFontFamily}>
          <SelectTrigger className="h-9 w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONTS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="number"
          min={8}
          max={120}
          value={props.fontSize}
          onChange={(e) => props.setFontSize(Number(e.target.value))}
          className="h-9 w-16 tabular-nums"
        />
      </div>

      <div className="ml-auto flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={props.onUndo}
          title="Geri al"
        >
          <Undo2 className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={props.onRedo}
          title="İleri al"
        >
          <Redo2 className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={props.onDeleteSelected}
          title="Seçileni sil"
        >
          <Trash2 className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={props.onClearAll}
          title="Tümünü temizle"
        >
          Tümü
        </Button>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

function makeArrow(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  width: number,
): fabric.Object {
  const line = new fabric.Line([x1, y1, x2, y2], {
    stroke: color,
    strokeWidth: width,
    originX: "center",
    originY: "center",
  });
  const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  const head = new fabric.Triangle({
    left: x2,
    top: y2,
    originX: "center",
    originY: "center",
    width: 14 + width * 1.5,
    height: 18 + width * 2,
    fill: color,
    angle: angle + 90,
  });
  return new fabric.Group([line, head], { hasControls: true });
}

function makeBadge(
  text: string,
  x: number,
  y: number,
  color: string,
  fontFamily: string,
): fabric.Object {
  const r = 18;
  const circle = new fabric.Circle({
    left: -r,
    top: -r,
    radius: r,
    fill: color,
    originX: "left",
    originY: "top",
  });
  const t = new fabric.Text(text, {
    left: 0,
    top: 0,
    fontSize: 22,
    fontFamily,
    fill: "#ffffff",
    fontWeight: "bold",
    originX: "center",
    originY: "center",
  });
  return new fabric.Group([circle, t], {
    left: x - r,
    top: y - r,
  });
}
