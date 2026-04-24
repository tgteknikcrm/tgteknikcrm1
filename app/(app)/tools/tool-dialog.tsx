"use client";

import { useState, useTransition } from "react";
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
import { saveTool } from "./actions";
import {
  TOOL_CONDITION_LABEL,
  type Tool,
  type ToolCondition,
} from "@/lib/supabase/types";
import { Loader2 } from "lucide-react";

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
      if (result.error) toast.error(result.error);
      else {
        toast.success(tool ? "Takım güncellendi" : "Takım eklendi");
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tool ? "Takım Düzenle" : "Yeni Takım"}</DialogTitle>
        </DialogHeader>
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
