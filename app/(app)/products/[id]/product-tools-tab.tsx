"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  Plus,
  Search,
  Trash2,
  Wrench,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import {
  toolImagePublicUrl,
  type ProductTool,
  type Tool,
} from "@/lib/supabase/types";
import {
  addProductTool,
  removeProductTool,
  updateProductToolQty,
} from "../actions";
import { cn } from "@/lib/utils";

export function ProductToolsTab({
  productId,
  productTools,
  tools,
}: {
  productId: string;
  productTools: ProductTool[];
  tools: Tool[];
}) {
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Local qty draft per tool — lets user edit without re-saving every keystroke.
  const [qtyDraft, setQtyDraft] = useState<Map<string, number>>(
    () => new Map(productTools.map((t) => [t.tool_id, t.quantity_used])),
  );

  const usedToolIds = useMemo(
    () => new Set(productTools.map((t) => t.tool_id)),
    [productTools],
  );

  function commitQty(toolId: string, qty: number) {
    if (qty < 1) return;
    const original = productTools.find((t) => t.tool_id === toolId)
      ?.quantity_used;
    if (original === qty) return;
    startTransition(async () => {
      const r = await updateProductToolQty(productId, toolId, qty);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Adet güncellendi");
      router.refresh();
    });
  }

  function removeOne(toolId: string, name: string) {
    if (!confirm(`'${name}' bu üründen kaldırılsın mı?`)) return;
    setBusyId(toolId);
    startTransition(async () => {
      const r = await removeProductTool(productId, toolId);
      setBusyId(null);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Takım kaldırıldı");
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="text-xs text-muted-foreground">
            Bu üründen iş açılınca <span className="font-semibold">job_tools</span>'a otomatik kopyalanır.
          </div>
          <Button onClick={() => setPickerOpen(true)} size="sm" className="gap-1.5">
            <Plus className="size-3.5" /> Takım Ekle
          </Button>
        </div>

        {productTools.length === 0 ? (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className={cn(
              "w-full rounded-lg border-2 border-dashed bg-card/40 hover:bg-card transition",
              "py-12 flex flex-col items-center justify-center gap-2 cursor-pointer",
            )}
          >
            <Wrench className="size-7 text-muted-foreground" />
            <div className="text-sm font-medium">İlk takımı ekle</div>
            <div className="text-xs text-muted-foreground">
              Stoktaki takımlardan bu ürün için varsayılan listesi oluştur.
            </div>
          </button>
        ) : (
          <ul className="space-y-1.5">
            {productTools.map((pt) => {
              const tool = tools.find((t) => t.id === pt.tool_id);
              const imgUrl = tool?.image_path
                ? toolImagePublicUrl(tool.image_path)
                : null;
              const draft = qtyDraft.get(pt.tool_id) ?? pt.quantity_used;
              return (
                <li
                  key={pt.tool_id}
                  className="group flex items-center gap-3 px-3 py-2 rounded-lg border bg-card hover:bg-muted/30 transition"
                >
                  <div className="size-10 rounded-md border bg-muted/40 overflow-hidden flex items-center justify-center shrink-0">
                    {imgUrl ? (
                      <Image
                        src={imgUrl}
                        alt={tool?.name ?? ""}
                        width={40}
                        height={40}
                        className="size-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <Wrench className="size-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">
                      {tool?.name ?? "Bilinmeyen takım"}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono">
                      {tool?.code ?? ""}
                      {tool?.size ? ` · ${tool.size}` : ""}
                      {tool?.location ? ` · ${tool.location}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={1}
                      value={draft}
                      onChange={(e) => {
                        const v = Math.max(1, Number(e.target.value) || 1);
                        setQtyDraft((prev) => {
                          const next = new Map(prev);
                          next.set(pt.tool_id, v);
                          return next;
                        });
                      }}
                      onBlur={() => commitQty(pt.tool_id, draft)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      className="w-16 h-8 text-sm tabular-nums text-center"
                    />
                    <span className="text-xs text-muted-foreground">adet</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      removeOne(pt.tool_id, tool?.name ?? "takım")
                    }
                    disabled={busyId === pt.tool_id}
                    className="size-8 text-red-600 hover:text-red-600 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition"
                  >
                    {busyId === pt.tool_id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      <ToolPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        availableTools={tools.filter((t) => !usedToolIds.has(t.id))}
        onAdd={(toolIds) => {
          startTransition(async () => {
            for (const toolId of toolIds) {
              const r = await addProductTool(productId, toolId, 1);
              if (r.error) {
                toast.error(r.error);
                return;
              }
            }
            toast.success(`${toolIds.length} takım eklendi`);
            setPickerOpen(false);
            router.refresh();
          });
        }}
        pending={pending}
      />
    </Card>
  );
}

function ToolPickerDialog({
  open,
  onOpenChange,
  availableTools,
  onAdd,
  pending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  availableTools: Tool[];
  onAdd: (ids: string[]) => void;
  pending: boolean;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr");
    if (!q) return availableTools;
    return availableTools.filter((t) => {
      const hay = [t.name, t.code, t.size, t.location, t.type, t.supplier]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr");
      return hay.includes(q);
    });
  }, [availableTools, search]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function reset() {
    setSearch("");
    setSelected(new Set());
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="max-w-md p-0 gap-0">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle>Takım Ekle</DialogTitle>
          <DialogDescription>Birden fazla seçebilirsin.</DialogDescription>
        </DialogHeader>
        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Takım ara…"
              className="pl-9 h-9"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto border-t">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {availableTools.length === 0
                ? "Eklenecek başka takım kalmadı."
                : "Eşleşen takım yok."}
            </div>
          ) : (
            filtered.map((t) => {
              const checked = selected.has(t.id);
              const imgUrl = t.image_path
                ? toolImagePublicUrl(t.image_path)
                : null;
              return (
                <label
                  key={t.id}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2 cursor-pointer transition border-b last:border-b-0",
                    "hover:bg-muted/60",
                    checked && "bg-primary/5",
                  )}
                >
                  <Checkbox checked={checked} onCheckedChange={() => toggle(t.id)} />
                  <div className="size-9 rounded-md border bg-muted/40 overflow-hidden flex items-center justify-center shrink-0">
                    {imgUrl ? (
                      <Image
                        src={imgUrl}
                        alt={t.name}
                        width={36}
                        height={36}
                        className="size-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <Wrench className="size-3.5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{t.name}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">
                      {t.code ?? ""}
                      {t.size ? ` · ${t.size}` : ""}
                    </div>
                  </div>
                  {checked && (
                    <Badge variant="default" className="shrink-0 gap-1">
                      <Check className="size-3" />
                    </Badge>
                  )}
                </label>
              );
            })
          )}
        </div>
        <DialogFooter className="p-3 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Kapat
          </Button>
          <Button
            type="button"
            onClick={() => onAdd(Array.from(selected))}
            disabled={selected.size === 0 || pending}
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Ekle ({selected.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
