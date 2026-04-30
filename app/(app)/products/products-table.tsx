"use client";

import { useMemo } from "react";
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
import { Wrench } from "lucide-react";
import type { Product, ProductTool, Tool } from "@/lib/supabase/types";
import { ProductDialog } from "./product-dialog";
import { DeleteButton } from "../operators/delete-button";
import { bulkDeleteProducts, deleteProduct } from "./actions";
import { useBulkSelection } from "@/lib/use-bulk-selection";
import { BulkActionsBar } from "@/components/app/bulk-actions-bar";

export function ProductsTable({
  products,
  tools,
  productTools,
}: {
  products: Product[];
  tools: Tool[];
  productTools: ProductTool[];
}) {
  const router = useRouter();
  const ids = useMemo(() => products.map((p) => p.id), [products]);
  const sel = useBulkSelection(ids);

  return (
    <>
      <BulkActionsBar
        count={sel.size}
        total={ids.length}
        onSelectAll={sel.selectAll}
        onClear={sel.clear}
        ids={sel.ids}
        itemLabel="ürün"
        onDelete={async (toDelete) => {
          const r = await bulkDeleteProducts(toDelete);
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
            <TableHead>Kod</TableHead>
            <TableHead>Ad</TableHead>
            <TableHead>Müşteri</TableHead>
            <TableHead className="text-right">Tipik Adet</TableHead>
            <TableHead className="text-center">Takımlar</TableHead>
            <TableHead className="text-right">İşlem</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((p) => {
            const productPt = productTools.filter(
              (pt) => pt.product_id === p.id,
            );
            return (
              <TableRow
                key={p.id}
                className={sel.has(p.id) ? "bg-primary/5" : undefined}
              >
                <TableCell>
                  <Checkbox
                    checked={sel.has(p.id)}
                    onCheckedChange={() => sel.toggle(p.id)}
                    onClick={(e) => {
                      if ((e as React.MouseEvent).shiftKey) {
                        e.preventDefault();
                        sel.toggleRange(p.id);
                      }
                    }}
                  />
                </TableCell>
                <TableCell className="font-mono font-bold">{p.code}</TableCell>
                <TableCell className="font-medium">
                  {p.name}
                  {p.description && (
                    <div className="text-xs text-muted-foreground truncate max-w-md mt-0.5">
                      {p.description}
                    </div>
                  )}
                </TableCell>
                <TableCell>{p.customer || "—"}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {p.default_quantity ?? "—"}
                </TableCell>
                <TableCell className="text-center">
                  {productPt.length > 0 ? (
                    <Badge variant="outline" className="font-normal gap-1">
                      <Wrench className="size-3" />
                      {productPt.length}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-1 justify-end">
                    <ProductDialog
                      product={p}
                      tools={tools}
                      existingTools={productPt}
                      trigger={
                        <Button variant="ghost" size="sm">
                          Düzenle
                        </Button>
                      }
                    />
                    <DeleteButton
                      action={() => deleteProduct(p.id)}
                      confirmText={`'${p.code}' ürünü silinsin mi? Bağlı işler/teknik resimler etkilenmez (sadece ürün referansı kaldırılır).`}
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
