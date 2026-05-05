"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
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
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  RAW_MATERIAL_SHAPE_LABEL,
  type RawMaterial,
  type RawMaterialShape,
} from "@/lib/supabase/types";
import { saveRawMaterial } from "../actions";

const SHAPES: RawMaterialShape[] = [
  "round",
  "square",
  "rectangular",
  "plate",
  "tube",
  "diger",
];

interface Props {
  material?: RawMaterial;
  trigger: React.ReactNode;
}

export function RawMaterialDialog({ material, trigger }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [code, setCode] = useState(material?.code ?? "");
  const [name, setName] = useState(material?.name ?? "");
  const [grade, setGrade] = useState(material?.material_grade ?? "");
  const [shape, setShape] = useState<RawMaterialShape>(
    material?.shape ?? "round",
  );
  const [diameter, setDiameter] = useState(
    material?.diameter_mm != null ? String(material.diameter_mm) : "",
  );
  const [width, setWidth] = useState(
    material?.width_mm != null ? String(material.width_mm) : "",
  );
  const [height, setHeight] = useState(
    material?.height_mm != null ? String(material.height_mm) : "",
  );
  const [thickness, setThickness] = useState(
    material?.thickness_mm != null ? String(material.thickness_mm) : "",
  );
  const [barLength, setBarLength] = useState(
    material?.bar_length_mm != null ? String(material.bar_length_mm) : "6000",
  );
  const [quantity, setQuantity] = useState(
    material?.quantity != null ? String(material.quantity) : "0",
  );
  const [unit, setUnit] = useState(material?.unit ?? "boy");
  const [supplier, setSupplier] = useState(material?.supplier ?? "");
  const [location, setLocation] = useState(material?.location ?? "");
  const [notes, setNotes] = useState(material?.notes ?? "");
  const [active, setActive] = useState(material?.active ?? true);

  function num(s: string): number | null {
    if (!s.trim()) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r = await saveRawMaterial({
        id: material?.id,
        code,
        name,
        material_grade: grade,
        shape,
        diameter_mm: num(diameter),
        width_mm: num(width),
        height_mm: num(height),
        thickness_mm: num(thickness),
        bar_length_mm: num(barLength),
        quantity: Number(quantity) || 0,
        unit,
        supplier,
        location,
        notes,
        active,
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(material ? "Hammadde güncellendi" : "Hammadde eklendi");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {material ? "Hammadde Düzenle" : "Yeni Hammadde"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kod *">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                required
                placeholder="HM-1040-50"
                className="h-11 font-mono uppercase"
              />
            </Field>
            <Field label="Ad *">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Ø50 yuvarlak 1040"
                className="h-11"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Malzeme Grade">
              <Input
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                placeholder="1040, 4140, AISI 304…"
                className="h-11"
              />
            </Field>
            <Field label="Şekil">
              <Select
                value={shape}
                onValueChange={(v) => setShape(v as RawMaterialShape)}
              >
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SHAPES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {RAW_MATERIAL_SHAPE_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <Field label="Çap (mm)">
              <Input
                type="number"
                step="0.1"
                value={diameter}
                onChange={(e) => setDiameter(e.target.value)}
                className="h-11 tabular-nums"
              />
            </Field>
            <Field label="En (mm)">
              <Input
                type="number"
                step="0.1"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                className="h-11 tabular-nums"
              />
            </Field>
            <Field label="Boy (mm)">
              <Input
                type="number"
                step="0.1"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                className="h-11 tabular-nums"
              />
            </Field>
            <Field label="Kalınlık (mm)">
              <Input
                type="number"
                step="0.1"
                value={thickness}
                onChange={(e) => setThickness(e.target.value)}
                className="h-11 tabular-nums"
              />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Çubuk Boyu (mm)" hint="genelde 6000">
              <Input
                type="number"
                step="1"
                value={barLength}
                onChange={(e) => setBarLength(e.target.value)}
                className="h-11 tabular-nums"
              />
            </Field>
            <Field label="Mevcut Stok *">
              <Input
                type="number"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                className="h-11 tabular-nums"
              />
            </Field>
            <Field label="Birim">
              <Input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="boy / adet / kg"
                className="h-11"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Tedarikçi">
              <Input
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="h-11"
              />
            </Field>
            <Field label="Konum / Raf">
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Raf-A3"
                className="h-11"
              />
            </Field>
          </div>

          <Field label="Notlar">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Tedarik bilgisi, sertifika no, vs."
            />
          </Field>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <Checkbox
              checked={active}
              onCheckedChange={(v) => setActive(v === true)}
            />
            <span className="text-sm">Aktif (kesim listesinde göster)</span>
          </label>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              İptal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {material ? "Kaydet" : "Ekle"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">
        {label}
        {hint && (
          <span className="text-muted-foreground font-normal ml-1">({hint})</span>
        )}
      </Label>
      {children}
    </div>
  );
}
