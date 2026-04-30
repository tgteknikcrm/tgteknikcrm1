"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Search, Trash2, Wrench } from "lucide-react";
import { toast } from "sonner";
import type { Product, ProductTool, Tool } from "@/lib/supabase/types";
import { saveProduct } from "./actions";
import { cn } from "@/lib/utils";

interface Props {
  trigger: React.ReactNode;
  product?: Product;
  existingTools?: ProductTool[];
  tools: Tool[];
}

interface ToolRow {
  tool_id: string;
  quantity_used: number;
}

export function ProductDialog({
  trigger,
  product,
  existingTools = [],
  tools,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [customer, setCustomer] = useState("");
  const [defaultQty, setDefaultQty] = useState("");
  const [notes, setNotes] = useState("");

  const [rows, setRows] = useState<ToolRow[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerSelected, setPickerSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      if (product) {
        setCode(product.code);
        setName(product.name);
        setDescription(product.description ?? "");
        setCustomer(product.customer ?? "");
        setDefaultQty(
          product.default_quantity != null
            ? String(product.default_quantity)
            : "",
        );
        setNotes(product.notes ?? "");
        setRows(
          existingTools.map((t) => ({
            tool_id: t.tool_id,
            quantity_used: t.quantity_used,
          })),
        );
      } else {
        setCode("");
        setName("");
        setDescription("");
        setCustomer("");
        setDefaultQty("");
        setNotes("");
        setRows([]);
      }
      setPickerOpen(false);
      setPickerSearch("");
      setPickerSelected(new Set());
    }
  }, [open, product, existingTools]);

  const usedToolIds = useMemo(
    () => new Set(rows.map((r) => r.tool_id)),
    [rows],
  );
  const pickerList = useMemo(() => {
    const q = pickerSearch.trim().toLocaleLowerCase("tr");
    return tools.filter((t) => {
      if (usedToolIds.has(t.id)) return false;
      if (!q) return true;
      const hay = [t.name, t.code, t.size, t.location, t.type, t.supplier]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr");
      return hay.includes(q);
    });
  }, [tools, usedToolIds, pickerSearch]);

  function togglePicker(id: string) {
    setPickerSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function addSelectedTools() {
    if (pickerSelected.size === 0) return;
    setRows((prev) => [
      ...prev,
      ...Array.from(pickerSelected).map((tool_id) => ({
        tool_id,
        quantity_used: 1,
      })),
    ]);
    setPickerSelected(new Set());
    setPickerOpen(false);
  }
  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.tool_id !== id));
  }
  function updateRow(id: string, qty: number) {
    setRows((prev) =>
      prev.map((r) => (r.tool_id === id ? { ...r, quantity_used: qty } : r)),
    );
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) {
      toast.error("Ürün kodu gerekli");
      return;
    }
    if (!name.trim()) {
      toast.error("Ürün adı gerekli");
      return;
    }
    // Sanitize default_quantity — only finite non-negative integers.
    let qty: number | null = null;
    if (defaultQty.trim() !== "") {
      const parsed = Number(defaultQty);
      if (!Number.isFinite(parsed) || parsed < 0) {
        toast.error("Tipik adet sayısal olmalı");
        return;
      }
      qty = Math.floor(parsed);
    }
    startTransition(async () => {
      try {
        const r = await saveProduct({
          id: product?.id,
          code: code.trim(),
          name: name.trim(),
          description: description || null,
          customer: customer || null,
          default_quantity: qty,
          notes: notes || null,
          tools: rows.map((r) => ({
            tool_id: r.tool_id,
            quantity_used: r.quantity_used,
          })),
        });
        if ("error" in r && r.error) {
          toast.error(r.error);
          return;
        }
        toast.success(product ? "Ürün güncellendi" : "Ürün oluşturuldu");
        setOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Beklenmeyen hata oluştu",
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? "Ürünü Düzenle" : "Yeni Ürün"}</DialogTitle>
          <DialogDescription>
            Tekrar eden parçayı tek bir ürün olarak tanımla. İş açarken bu
            ürünü seçince teknik resim, takım listesi ve CAD/CAM dosyaları
            otomatik kullanılabilir hale gelir.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p-code">
                Ürün Kodu *
                <span className="text-muted-foreground font-normal ml-1">
                  (FLN-50-A vb.)
                </span>
              </Label>
              <Input
                id="p-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                required
                placeholder="FLN-50-A"
                className="font-mono uppercase"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-name">Ürün Adı *</Label>
              <Input
                id="p-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Flanş Ø50 Rev.2"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p-customer">Müşteri (opsiyonel)</Label>
              <Input
                id="p-customer"
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                placeholder="Müşteri adı"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-qty">Tipik Sipariş Adedi</Label>
              <Input
                id="p-qty"
                type="number"
                min={0}
                value={defaultQty}
                onChange={(e) => setDefaultQty(e.target.value)}
                placeholder="örn. 100"
                className="tabular-nums"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="p-desc">Açıklama</Label>
            <Textarea
              id="p-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Malzeme, ölçü, teslim koşulu vs."
            />
          </div>

          {/* ── Default tool list ── */}
          <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Wrench className="size-3.5" /> Varsayılan Takım Listesi
                <Badge variant="outline" className="h-5 text-[10px] ml-1">
                  {rows.length}
                </Badge>
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs gap-1"
                onClick={() => setPickerOpen((v) => !v)}
                disabled={
                  tools.length === 0 || rows.length >= tools.length
                }
              >
                <Plus className="size-3.5" />
                Takım Ekle
              </Button>
            </div>

            {rows.length === 0 ? (
              <div className="text-xs text-muted-foreground italic py-2">
                Henüz takım eklenmedi. İş bu üründen seçildiğinde, eklediğin
                takımlar otomatik olarak işin takım listesine kopyalanır.
              </div>
            ) : (
              <div className="space-y-1.5">
                {rows.map((r) => {
                  const tool = tools.find((t) => t.id === r.tool_id);
                  return (
                    <div
                      key={r.tool_id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-background border"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">
                          {tool?.name ?? "—"}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          {tool?.code ?? ""}
                          {tool?.size ? ` · ${tool.size}` : ""}
                        </div>
                      </div>
                      <Input
                        type="number"
                        min={1}
                        value={r.quantity_used}
                        onChange={(e) =>
                          updateRow(r.tool_id, Number(e.target.value) || 1)
                        }
                        className="w-20 h-8 text-sm tabular-nums"
                      />
                      <span className="text-xs text-muted-foreground">
                        adet
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRow(r.tool_id)}
                        className="size-7"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {pickerOpen && (
              <div className="rounded-md border bg-background p-2 space-y-2 mt-2 animate-tg-fade-in">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    value={pickerSearch}
                    onChange={(e) => setPickerSearch(e.target.value)}
                    placeholder="Takım ara…"
                    className="pl-9 h-8"
                    autoFocus
                  />
                </div>
                <div className="max-h-56 overflow-y-auto divide-y rounded border">
                  {pickerList.length === 0 ? (
                    <div className="p-3 text-center text-xs text-muted-foreground">
                      Eşleşen takım yok.
                    </div>
                  ) : (
                    pickerList.map((t) => {
                      const checked = pickerSelected.has(t.id);
                      return (
                        <label
                          key={t.id}
                          className={cn(
                            "flex items-center gap-2.5 px-2 py-1.5 cursor-pointer transition",
                            "hover:bg-muted/60",
                            checked && "bg-primary/5",
                          )}
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => togglePicker(t.id)}
                          />
                          <div className="text-sm font-medium truncate flex-1">
                            {t.name}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            {t.code ?? ""}
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
                <div className="flex justify-end gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setPickerOpen(false)}
                  >
                    Kapat
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={addSelectedTools}
                    disabled={pickerSelected.size === 0}
                  >
                    <Plus className="size-3.5" />
                    Ekle ({pickerSelected.size})
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="p-notes">Notlar</Label>
            <Textarea
              id="p-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="İşleme özel hatırlatmalar"
            />
          </div>

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
              {product ? "Kaydet" : "Oluştur"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
