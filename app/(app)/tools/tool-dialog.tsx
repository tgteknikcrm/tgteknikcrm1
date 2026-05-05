"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { saveTool, setToolImage } from "./actions";
import { ToolImageUpload } from "./image-upload";
import {
  TOOL_CONDITION_LABEL,
  type Tool,
  type ToolCondition,
} from "@/lib/supabase/types";
import { Loader2, Camera, Upload, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  tool?: Tool;
  trigger: React.ReactNode;
}

const CONDITIONS: ToolCondition[] = ["yeni", "iyi", "kullanilabilir", "degistirilmeli"];

export function ToolDialog({ tool, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [code, setCode] = useState(tool?.code ?? "");
  const [name, setName] = useState(tool?.name ?? "");
  const [type, setType] = useState(tool?.type ?? "");
  const [size, setSize] = useState(tool?.size ?? "");
  const [material, setMaterial] = useState(tool?.material ?? "");
  const [location, setLocation] = useState(tool?.location ?? "");
  const [quantity, setQuantity] = useState(tool?.quantity ?? 0);
  const [minQuantity, setMinQuantity] = useState(tool?.min_quantity ?? 0);
  const [condition, setCondition] = useState<ToolCondition>(tool?.condition ?? "iyi");
  const [supplier, setSupplier] = useState(tool?.supplier ?? "");
  const [price, setPrice] = useState<string>(tool?.price?.toString() ?? "");
  const [notes, setNotes] = useState(tool?.notes ?? "");

  // Staged image (only used for new tools — uploaded after saveTool returns id)
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [stagedPreview, setStagedPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Build/cleanup object URL for the staged preview.
  useEffect(() => {
    if (!stagedFile) {
      setStagedPreview(null);
      return;
    }
    const url = URL.createObjectURL(stagedFile);
    setStagedPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [stagedFile]);

  function pickFile() {
    fileInputRef.current?.click();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Sadece görsel dosyası seçilebilir.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Dosya en fazla 8 MB olabilir.");
      return;
    }
    setStagedFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function clearStaged() {
    setStagedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await saveTool({
        id: tool?.id,
        code,
        name,
        type,
        size,
        material,
        location,
        quantity,
        min_quantity: minQuantity,
        condition,
        supplier,
        price: price ? Number(price) : null,
        notes,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }

      // If we staged an image during create, upload it now using the new id.
      if (!tool && stagedFile && result.id) {
        const fd = new FormData();
        fd.append("file", stagedFile);
        const up = await setToolImage(result.id, fd);
        if (up.error) {
          toast.error("Takım eklendi ama resim yüklenemedi: " + up.error);
        } else {
          toast.success("Takım ve resim kaydedildi");
        }
      } else {
        toast.success(tool ? "Takım güncellendi" : "Takım eklendi");
      }
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tool ? "Takım Düzenle" : "Yeni Takım"}</DialogTitle>
        </DialogHeader>

        {/* Image section — for existing tools use live upload; for new tools, stage a file */}
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5">
            <Camera className="size-3.5" /> Resim
          </Label>
          {tool ? (
            <ToolImageUpload toolId={tool.id} initialPath={tool.image_path} />
          ) : (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onFileChange}
              />
              {stagedPreview ? (
                <div className="relative group rounded-lg overflow-hidden border bg-muted/30">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={stagedPreview}
                    alt="Önizleme"
                    className="w-full max-h-56 object-contain"
                  />
                  <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={pickFile}
                      disabled={pending}
                      className="h-8 shadow"
                    >
                      <Upload className="size-3.5" /> Değiştir
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={clearStaged}
                      disabled={pending}
                      className="h-8 shadow"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                  <div className="absolute bottom-2 left-2 rounded bg-background/80 backdrop-blur px-2 py-1 text-xs">
                    Kaydedince yüklenecek
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={pickFile}
                  disabled={pending}
                  className={cn(
                    "w-full rounded-lg border-2 border-dashed p-6 flex flex-col items-center justify-center gap-2 text-muted-foreground transition",
                    "hover:border-primary/50 hover:bg-muted/30 hover:text-foreground",
                    pending && "opacity-60 cursor-wait",
                  )}
                >
                  <Camera className="size-7" />
                  <div className="text-center">
                    <p className="text-sm font-medium">Resim ekle (opsiyonel)</p>
                    <p className="text-xs text-muted-foreground">
                      JPG / PNG / WebP · maks 8 MB
                    </p>
                  </div>
                </button>
              )}
            </>
          )}
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tc">Kod</Label>
              <Input id="tc" value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tn">İsim *</Label>
              <Input id="tn" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tt">Tip</Label>
              <Input id="tt" value={type} onChange={(e) => setType(e.target.value)} placeholder="Freze, Matkap..." />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ts">Ölçü</Label>
              <Input id="ts" value={size} onChange={(e) => setSize(e.target.value)} placeholder="ör. Ø10mm" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tm">Malzeme</Label>
              <Input id="tm" value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="HSS, Karbür..." />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tl">Konum / Raf</Label>
              <Input id="tl" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tsp">Tedarikçi</Label>
              <Input id="tsp" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tq">Stok</Label>
              <Input
                id="tq"
                type="number"
                min={0}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tmq">Min. Stok</Label>
              <Input
                id="tmq"
                type="number"
                min={0}
                value={minQuantity}
                onChange={(e) => setMinQuantity(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tp">Fiyat (₺)</Label>
              <Input
                id="tp"
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tcd">Durum *</Label>
            <Select value={condition} onValueChange={(v) => setCondition(v as ToolCondition)}>
              <SelectTrigger id="tcd">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONDITIONS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {TOOL_CONDITION_LABEL[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tno">Notlar</Label>
            <Textarea id="tno" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              İptal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {tool ? "Kaydet" : "Ekle"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
