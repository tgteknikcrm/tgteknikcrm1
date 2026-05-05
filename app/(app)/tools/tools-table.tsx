"use client";

import { useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, ShoppingCart, Wrench } from "lucide-react";
import {
  TOOL_CONDITION_LABEL,
  toolImagePublicUrl,
  type Supplier,
  type Tool,
} from "@/lib/supabase/types";
import { ToolDialog } from "./tool-dialog";
import { OrderDialog } from "../orders/order-dialog";
import { DeleteButton } from "../operators/delete-button";
import { bulkDeleteTools, deleteTool } from "./actions";
import { useBulkSelection } from "@/lib/use-bulk-selection";
import { BulkActionsBar } from "@/components/app/bulk-actions-bar";

export function ToolsTable({
  tools,
  suppliers,
}: {
  tools: Tool[];
  suppliers: Pick<Supplier, "id" | "name">[];
}) {
  const router = useRouter();
  const ids = useMemo(() => tools.map((t) => t.id), [tools]);
  const sel = useBulkSelection(ids);

  return (
    <>
      <BulkActionsBar
        count={sel.size}
        total={ids.length}
        onSelectAll={sel.selectAll}
        onClear={sel.clear}
        ids={sel.ids}
        itemLabel="takım"
        onDelete={async (toDelete) => {
          const r = await bulkDeleteTools(toDelete);
          router.refresh();
          return r;
        }}
      />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={
                  sel.allSelected
                    ? true
                    : sel.someSelected
                      ? "indeterminate"
                      : false
                }
                onCheckedChange={(v) => (v ? sel.selectAll() : sel.clear())}
                aria-label="Tümünü seç"
              />
            </TableHead>
            <TableHead className="w-16">Görsel</TableHead>
            <TableHead>Kod</TableHead>
            <TableHead>Ad</TableHead>
            <TableHead>Tip</TableHead>
            <TableHead>Konum</TableHead>
            <TableHead className="text-right">Adet</TableHead>
            <TableHead>Durum</TableHead>
            <TableHead className="text-right">İşlem</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tools.map((t) => {
            const low =
              t.min_quantity > 0 && t.quantity <= t.min_quantity;
            const url = toolImagePublicUrl(t.image_path);
            return (
              <TableRow
                key={t.id}
                className={sel.has(t.id) ? "bg-primary/5" : undefined}
              >
                <TableCell>
                  <Checkbox
                    checked={sel.has(t.id)}
                    onCheckedChange={() => sel.toggle(t.id)}
                    onClick={(e) => {
                      if ((e as React.MouseEvent).shiftKey) {
                        e.preventDefault();
                        sel.toggleRange(t.id);
                      }
                    }}
                  />
                </TableCell>
                <TableCell>
                  <div className="size-10 rounded-md border bg-muted/40 flex items-center justify-center overflow-hidden">
                    {url ? (
                      <Image
                        src={url}
                        alt={t.name}
                        width={40}
                        height={40}
                        className="size-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <Wrench className="size-4 text-muted-foreground" />
                    )}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {t.code || "—"}
                </TableCell>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {t.type || "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {t.location || "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <span
                    className={
                      low ? "text-amber-700 font-semibold" : undefined
                    }
                  >
                    {t.quantity}
                  </span>
                  {low && (
                    <AlertTriangle className="inline size-3.5 ml-1 text-amber-600" />
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {TOOL_CONDITION_LABEL[t.condition]}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-1 justify-end">
                    <OrderDialog
                      suppliers={suppliers}
                      defaultCategory="takim"
                      defaultDescription={
                        t.code ? `${t.code} — ${t.name}` : t.name
                      }
                      trigger={
                        <Button
                          variant={low ? "default" : "ghost"}
                          size="sm"
                          title="Bu takım için sipariş oluştur"
                        >
                          <ShoppingCart className="size-4" />
                          {low && <span className="ml-1">Sipariş</span>}
                        </Button>
                      }
                    />
                    <ToolDialog
                      tool={t}
                      trigger={
                        <Button variant="ghost" size="sm">
                          Düzenle
                        </Button>
                      }
                    />
                    <DeleteButton
                      action={() => deleteTool(t.id)}
                      confirmText={`'${t.name}' silinsin mi?`}
                    />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </>
  );
}
