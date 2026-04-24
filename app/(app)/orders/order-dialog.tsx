"use client";

import { useState, useTransition, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { saveOrder, type SaveOrderInput, type OrderItemInput } from "./actions";
import {
  PO_ITEM_CATEGORY_LABEL,
  PO_ITEM_PRESETS,
  PO_STATUS_LABEL,
  type PoItemCategory,
  type PoStatus,
  type Supplier,
  type PurchaseOrder,
  type PurchaseOrderItem,
} from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

interface Props {
  trigger: React.ReactNode;
  suppliers: Pick<Supplier, "id" | "name">[];
  order?: PurchaseOrder & { items: PurchaseOrderItem[] };
  defaultCategory?: PoItemCategory;
  defaultDescription?: string;
}

function rowKey() {
  return Math.random().toString(36).slice(2);
}

type Row = OrderItemInput & { _key: string };

export function OrderDialog({
  trigger,
  suppliers,
  order,
  defaultCategory,
  defaultDescription,
}: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [supplierId, setSupplierId] = useState<string>(order?.supplier_id ?? "none");
  const [status, setStatus] = useState<PoStatus>(order?.status ?? "taslak");
  const [orderDate, setOrderDate] = useState<string>(
    order?.order_date ?? new Date().toISOString().slice(0, 10),
  );
  const [expectedDate, setExpectedDate] = useState<string>(order?.expected_date ?? "");
  const [orderNo, setOrderNo] = useState<string>(order?.order_no ?? "");
  const [notes, setNotes] = useState<string>(order?.notes ?? "");
  const [rows, setRows] = useState<Row[]>(
    order?.items?.length
      ? order.items.map((it) => ({
          _key: rowKey(),
          id: it.id,
          category: it.category,
          description: it.description,
          quantity: Number(it.quantity),
          unit: it.unit,
          unit_price: it.unit_price === null ? null : Number(it.unit_price),
          notes: it.notes,
        }))
      : [],
  );

  // Pre-fill an item row if the dialog was opened with a default (e.g. from
  // the Tools page's "Sipariş Oluştur" button).
  useEffect(() => {
    if (open && defaultCategory && rows.length === 0) {
      addRow(defaultCategory, defaultDescription);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function addRow(category: PoItemCategory, description = "") {
    const preset = PO_ITEM_PRESETS.find((p) => p.category === category);
    setRows((prev) => [
      ...prev,
      {
        _key: rowKey(),
        category,
        description,
        quantity: 1,
        unit: preset?.defaultUnit ?? "adet",
        unit_price: null,
        notes: null,
      },
    ]);
  }

  function updateRow(key: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r._key === key ? { ...r, ...patch } : r)));
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r._key !== key));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const payload: SaveOrderInput = {
        id: order?.id,
        order_no: orderNo || undefined,
        supplier_id: supplierId === "none" ? null : supplierId,
        status,
        order_date: orderDate,
        expected_date: expectedDate || null,
        notes,
        items: rows.map((r) => {
          const { _key, ...rest } = r;
          void _key;
          return rest;
        }),
      };
      const r = await saveOrder(payload);
      if (r.error) toast.error(r.error);
      else {
        toast.success(order ? "Sipariş güncellendi" : "Sipariş oluşturuldu");
        setOpen(false);
      }
    });
  }

  const total = rows.reduce(
    (s, r) => s + (Number(r.quantity) || 0) * (Number(r.unit_price) || 0),
    0,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{order ? "Sipariş Düzenle" : "Yeni Sipariş"}</DialogTitle>
          <DialogDescription>
            Tedarikçi, kalemler ve teslim tarihi. Hızlı eklemek için aşağıdaki kategori
            tuşlarını kullan.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          {/* Header fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="o-supplier">Tedarikçi</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger id="o-supplier">
                  <SelectValue placeholder="Seçilmedi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— (yok)</SelectItem>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="o-status">Durum</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as PoStatus)}>
                <SelectTrigger id="o-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PO_STATUS_LABEL) as PoStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {PO_STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="o-date">Sipariş Tarihi</Label>
              <Input
                id="o-date"
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="o-exp">Beklenen Teslim</Label>
              <Input
                id="o-exp"
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="o-no">Sipariş No (boş bırakırsan otomatik)</Label>
              <Input
                id="o-no"
                value={orderNo}
                onChange={(e) => setOrderNo(e.target.value)}
                placeholder={order ? "" : "SO-2026-0001 (otomatik)"}
              />
            </div>
          </div>

          {/* Quick-add presets */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Hızlı Ekle
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {PO_ITEM_PRESETS.map((p) => (
                <Button
                  key={p.category}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addRow(p.category)}
                  className="h-8 gap-1"
                >
                  <span>{p.emoji}</span>
                  <Plus className="size-3" />
                  {PO_ITEM_CATEGORY_LABEL[p.category]}
                </Button>
              ))}
            </div>
          </div>

          {/* Items */}
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Kalemler ({rows.length})
              </Label>
              {total > 0 && (
                <span className="text-sm tabular-nums">
                  Toplam:{" "}
                  <span className="font-bold">
                    {total.toLocaleString("tr-TR", {
                      style: "currency",
                      currency: "TRY",
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </span>
              )}
            </div>
            {rows.length === 0 ? (
              <div className="border-2 border-dashed rounded-lg p-6 text-center text-sm text-muted-foreground">
                Henüz kalem eklenmedi. Yukarıdaki tuşlardan birine tıkla.
              </div>
            ) : (
              <div className="space-y-2">
                {rows.map((r) => (
                  <ItemRow
                    key={r._key}
                    row={r}
                    onChange={(patch) => updateRow(r._key, patch)}
                    onRemove={() => removeRow(r._key)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="o-notes">Notlar</Label>
            <Textarea
              id="o-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              İptal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {order ? "Kaydet" : "Oluştur"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ItemRow({
  row,
  onChange,
  onRemove,
}: {
  row: Row;
  onChange: (patch: Partial<Row>) => void;
  onRemove: () => void;
}) {
  const preset = PO_ITEM_PRESETS.find((p) => p.category === row.category);
  return (
    <div className="grid grid-cols-12 gap-2 items-start p-2 rounded-lg border bg-muted/20">
      <div className="col-span-12 sm:col-span-2 flex items-center">
        <Badge variant="outline" className={cn("gap-1 font-normal w-full justify-start")}>
          <span>{preset?.emoji}</span>
          {PO_ITEM_CATEGORY_LABEL[row.category]}
        </Badge>
      </div>
      <div className="col-span-12 sm:col-span-5">
        <Input
          value={row.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Açıklama (örn. Endmill 6mm HSS)"
          required
          className="h-9"
        />
      </div>
      <div className="col-span-4 sm:col-span-1">
        <Input
          type="number"
          step="0.01"
          min="0"
          value={row.quantity}
          onChange={(e) => onChange({ quantity: Number(e.target.value) })}
          className="h-9 tabular-nums"
        />
      </div>
      <div className="col-span-4 sm:col-span-1">
        <Input
          value={row.unit}
          onChange={(e) => onChange({ unit: e.target.value })}
          placeholder="adet"
          className="h-9"
        />
      </div>
      <div className="col-span-3 sm:col-span-2">
        <Input
          type="number"
          step="0.01"
          min="0"
          value={row.unit_price ?? ""}
          onChange={(e) =>
            onChange({ unit_price: e.target.value === "" ? null : Number(e.target.value) })
          }
          placeholder="Fiyat"
          className="h-9 tabular-nums"
        />
      </div>
      <div className="col-span-1 flex items-center justify-end">
        <Button type="button" variant="ghost" size="icon" onClick={onRemove} title="Sil">
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}
