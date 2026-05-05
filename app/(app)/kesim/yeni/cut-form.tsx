"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Scissors, Calculator } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  RAW_MATERIAL_SHAPE_LABEL,
  type Product,
  type RawMaterial,
} from "@/lib/supabase/types";
import { createCut } from "../actions";

interface Props {
  materials: RawMaterial[];
  products: Pick<Product, "id" | "code" | "name" | "customer" | "status">[];
  defaultMaterialId?: string;
  defaultProductId?: string;
}

export function CutForm({
  materials,
  products,
  defaultMaterialId,
  defaultProductId,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [materialId, setMaterialId] = useState(defaultMaterialId ?? "");
  const [productId, setProductId] = useState(defaultProductId ?? "none");
  const [cutLength, setCutLength] = useState<string>("");
  const [quantityCut, setQuantityCut] = useState<string>("");
  const [barsConsumed, setBarsConsumed] = useState<string>("");
  const [lotNo, setLotNo] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  const selectedMaterial = useMemo(
    () => materials.find((m) => m.id === materialId),
    [materials, materialId],
  );

  // Helper math: estimate pieces per bar based on bar_length and cut_length.
  // Operator can override the result freely, but this gives a sane starting
  // value.
  const estimatedPiecesPerBar = useMemo(() => {
    const len = Number(cutLength);
    if (!selectedMaterial?.bar_length_mm || !Number.isFinite(len) || len <= 0) {
      return 0;
    }
    return Math.floor(Number(selectedMaterial.bar_length_mm) / len);
  }, [selectedMaterial, cutLength]);

  function autofillFromBars() {
    const bars = Number(barsConsumed);
    if (!Number.isFinite(bars) || bars <= 0 || estimatedPiecesPerBar === 0) {
      return;
    }
    setQuantityCut(String(bars * estimatedPiecesPerBar));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!materialId) {
      toast.error("Hammadde seç");
      return;
    }
    const qty = parseInt(quantityCut, 10);
    const bars = Number(barsConsumed);
    const len = Number(cutLength);
    if (!Number.isFinite(len) || len <= 0) {
      toast.error("Kesim uzunluğu girilmedi");
      return;
    }
    if (!Number.isInteger(qty) || qty <= 0) {
      toast.error("Kesim adedi geçersiz");
      return;
    }
    if (!Number.isFinite(bars) || bars <= 0) {
      toast.error("Tüketilen boy adedi girilmedi");
      return;
    }
    startTransition(async () => {
      const r = await createCut({
        raw_material_id: materialId,
        product_id: productId === "none" ? null : productId,
        cut_length_mm: len,
        bars_consumed: bars,
        quantity_cut: qty,
        lot_no: lotNo || null,
        location: location || null,
        notes: notes || null,
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(`${qty} adet parça kesildi → stoğa eklendi`);
      router.push("/kesim");
    });
  }

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={onSubmit} className="space-y-5">
          {/* Hammadde seçim */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">Hammadde *</Label>
            {materials.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed p-4 text-sm text-muted-foreground">
                Stokta aktif hammadde yok.{" "}
                <a
                  className="underline text-primary"
                  href="/kesim/hammadde"
                >
                  Önce hammadde ekle.
                </a>
              </div>
            ) : (
              <Select value={materialId} onValueChange={setMaterialId}>
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="Hammadde seç" />
                </SelectTrigger>
                <SelectContent>
                  {materials.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      <span className="font-mono">{m.code}</span> · {m.name}
                      <span className="text-xs text-muted-foreground ml-2">
                        ({m.quantity} {m.unit})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {selectedMaterial && (
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge variant="outline" className="text-[11px]">
                  {RAW_MATERIAL_SHAPE_LABEL[selectedMaterial.shape]}
                </Badge>
                {selectedMaterial.material_grade && (
                  <Badge variant="outline" className="text-[11px]">
                    {selectedMaterial.material_grade}
                  </Badge>
                )}
                {selectedMaterial.diameter_mm && (
                  <Badge variant="outline" className="text-[11px]">
                    Ø{selectedMaterial.diameter_mm}mm
                  </Badge>
                )}
                {selectedMaterial.bar_length_mm && (
                  <Badge variant="outline" className="text-[11px]">
                    {selectedMaterial.bar_length_mm} mm boy
                  </Badge>
                )}
                <Badge
                  variant="outline"
                  className="text-[11px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/40"
                >
                  Stok: {selectedMaterial.quantity} {selectedMaterial.unit}
                </Badge>
                {selectedMaterial.location && (
                  <span className="text-xs text-muted-foreground self-center">
                    📍 {selectedMaterial.location}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Hangi ürün için */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">
              Hangi Ürün İçin?{" "}
              <span className="text-sm text-muted-foreground font-normal">
                (opsiyonel — boş bırakırsan genel stok)
              </span>
            </Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger className="h-12 text-base">
                <SelectValue placeholder="Ürün seç (opsiyonel)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— (Genel stok)</SelectItem>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="font-mono">{p.code}</span> · {p.name}
                    {p.customer && (
                      <span className="text-xs text-muted-foreground ml-2">
                        {p.customer}
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Kesim parametreleri */}
          <div className="rounded-xl border bg-muted/20 p-4 space-y-4">
            <div className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Scissors className="size-3.5" />
              Kesim Parametreleri
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label className="text-base">Kesim Uzunluğu (mm) *</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={cutLength}
                  onChange={(e) => setCutLength(e.target.value)}
                  required
                  placeholder="120"
                  className="h-12 text-lg tabular-nums"
                />
                {estimatedPiecesPerBar > 0 && selectedMaterial && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calculator className="size-3" />
                    Boy başına ~{estimatedPiecesPerBar} parça
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-base">Tüketilen Boy *</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={barsConsumed}
                  onChange={(e) => setBarsConsumed(e.target.value)}
                  onBlur={autofillFromBars}
                  required
                  placeholder="2"
                  className="h-12 text-lg tabular-nums"
                />
                <p className="text-xs text-muted-foreground">
                  Hammadde stoğu bu kadar düşer
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-base">Çıkan Parça Adedi *</Label>
                <Input
                  type="number"
                  step="1"
                  value={quantityCut}
                  onChange={(e) => setQuantityCut(e.target.value)}
                  required
                  placeholder="50"
                  className={cn(
                    "h-12 text-lg tabular-nums font-bold",
                    Number(quantityCut) > 0 && "text-emerald-700 dark:text-emerald-400",
                  )}
                />
                <p className="text-xs text-muted-foreground">
                  Stoğa eklenen parça adedi
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Lot / Parti No</Label>
              <Input
                value={lotNo}
                onChange={(e) => setLotNo(e.target.value)}
                placeholder="LOT-2026-001"
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Konum / Raf</Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Sevk-bölmesi-2"
                className="h-11"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notlar</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Off-cut kaldı, talaş normalden fazla, vb."
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.back()}
            >
              İptal
            </Button>
            <Button
              type="submit"
              disabled={pending || materials.length === 0}
              className="h-11 px-6 gap-1.5"
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Scissors className="size-4" />
              )}
              Kesimi Kaydet
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
