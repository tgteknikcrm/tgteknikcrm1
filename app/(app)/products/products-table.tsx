"use client";

import { useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
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
import { Boxes, Wrench } from "lucide-react";
import {
  PRODUCT_STATUS_LABEL,
  PRODUCT_STATUS_TONE,
  productImagePublicUrl,
  type Product,
  type ProductImage,
  type ProductTool,
} from "@/lib/supabase/types";
import { DeleteButton } from "../operators/delete-button";
import { bulkDeleteProducts, deleteProduct } from "./actions";
import { useBulkSelection } from "@/lib/use-bulk-selection";
import { BulkActionsBar } from "@/components/app/bulk-actions-bar";
import { cn } from "@/lib/utils";

export function ProductsTable({
  products,
  productTools,
  primaryImages,
}: {
  products: Product[];
  productTools: ProductTool[];
  primaryImages: Pick<
    ProductImage,
    "product_id" | "image_path" | "is_primary" | "sort_order"
  >[];
}) {
  const router = useRouter();
  const ids = useMemo(() => products.map((p) => p.id), [products]);
  const sel = useBulkSelection(ids);
  const primaryByProduct = useMemo(
    () => new Map(primaryImages.map((i) => [i.product_id, i.image_path])),
    [primaryImages],
  );

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
            <TableHead className="w-14">Görsel</TableHead>
            <TableHead>Kod</TableHead>
            <TableHead>Ad</TableHead>
            <TableHead>Kategori</TableHead>
            <TableHead>Müşteri</TableHead>
            <TableHead>Malzeme</TableHead>
            <TableHead>Durum</TableHead>
            <TableHead className="text-center">Takım</TableHead>
            <TableHead className="text-right">İşlem</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((p) => {
            const productPt = productTools.filter(
              (pt) => pt.product_id === p.id,
            );
            const imgPath = primaryByProduct.get(p.id);
            const imgUrl = imgPath ? productImagePublicUrl(imgPath) : null;
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
                <TableCell>
                  <Link
                    href={`/products/${p.id}`}
                    className="block size-10 rounded-md border bg-muted/40 overflow-hidden flex items-center justify-center hover:ring-2 hover:ring-primary/30 transition"
                  >
                    {imgUrl ? (
                      <Image
                        src={imgUrl}
                        alt={p.name}
                        width={40}
                        height={40}
                        className="size-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <Boxes className="size-4 text-muted-foreground" />
                    )}
                  </Link>
                </TableCell>
                <TableCell className="font-mono font-bold">
                  <Link
                    href={`/products/${p.id}`}
                    className="hover:underline"
                  >
                    {p.code}
                  </Link>
                </TableCell>
                <TableCell className="font-medium">
                  <Link
                    href={`/products/${p.id}`}
                    className="hover:underline"
                  >
                    {p.name}
                  </Link>
                  {p.revision && (
                    <Badge variant="outline" className="ml-1.5 text-[10px]">
                      Rev. {p.revision}
                    </Badge>
                  )}
                  {p.description && (
                    <div className="text-xs text-muted-foreground truncate max-w-md mt-0.5">
                      {p.description}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {p.category || "—"}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {p.customer || "—"}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {p.material || "—"}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn("border", PRODUCT_STATUS_TONE[p.status])}
                  >
                    {PRODUCT_STATUS_LABEL[p.status]}
                  </Badge>
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
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/products/${p.id}`}>Aç</Link>
                    </Button>
                    <DeleteButton
                      action={() => deleteProduct(p.id)}
                      confirmText={`'${p.code}' ürünü silinsin mi?`}
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
