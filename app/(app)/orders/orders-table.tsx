"use client";

import { useMemo } from "react";
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
import {
  PO_STATUS_LABEL,
  PO_STATUS_TONE,
  type PurchaseOrder,
  type Supplier,
} from "@/lib/supabase/types";
import { DeleteButton } from "../operators/delete-button";
import { bulkDeleteOrders, deleteOrder } from "./actions";
import { useBulkSelection } from "@/lib/use-bulk-selection";
import { BulkActionsBar } from "@/components/app/bulk-actions-bar";
import { formatDate, cn } from "@/lib/utils";

type OrderRow = PurchaseOrder & {
  supplier: Pick<Supplier, "id" | "name"> | null;
  items: { quantity: number; unit_price: number | null }[];
};

export function OrdersTable({ orders }: { orders: OrderRow[] }) {
  const router = useRouter();
  const ids = useMemo(() => orders.map((o) => o.id), [orders]);
  const sel = useBulkSelection(ids);

  return (
    <>
      <BulkActionsBar
        count={sel.size}
        total={ids.length}
        onSelectAll={sel.selectAll}
        onClear={sel.clear}
        ids={sel.ids}
        itemLabel="sipariş"
        onDelete={async (toDelete) => {
          const r = await bulkDeleteOrders(toDelete);
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
            <TableHead>Sipariş No</TableHead>
            <TableHead>Tedarikçi</TableHead>
            <TableHead>Tarih</TableHead>
            <TableHead>Beklenen</TableHead>
            <TableHead className="text-right">Kalem</TableHead>
            <TableHead className="text-right">Toplam</TableHead>
            <TableHead>Durum</TableHead>
            <TableHead className="text-right">İşlem</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((o) => {
            const total = o.items.reduce(
              (s, it) =>
                s + Number(it.quantity ?? 0) * Number(it.unit_price ?? 0),
              0,
            );
            return (
              <TableRow
                key={o.id}
                className={sel.has(o.id) ? "bg-primary/5" : undefined}
              >
                <TableCell>
                  <Checkbox
                    checked={sel.has(o.id)}
                    onCheckedChange={() => sel.toggle(o.id)}
                    onClick={(e) => {
                      if ((e as React.MouseEvent).shiftKey) {
                        e.preventDefault();
                        sel.toggleRange(o.id);
                      }
                    }}
                  />
                </TableCell>
                <TableCell className="font-mono text-sm font-medium">
                  <Link
                    href={`/orders/${o.id}`}
                    className="hover:underline"
                  >
                    {o.order_no || "—"}
                  </Link>
                </TableCell>
                <TableCell>{o.supplier?.name || "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(o.order_date)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {o.expected_date ? formatDate(o.expected_date) : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm">
                  {o.items.length}
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {total > 0
                    ? total.toLocaleString("tr-TR", {
                        style: "currency",
                        currency: "TRY",
                        maximumFractionDigits: 2,
                      })
                    : "—"}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn("border", PO_STATUS_TONE[o.status])}
                  >
                    {PO_STATUS_LABEL[o.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-1 justify-end">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/orders/${o.id}`}>Aç</Link>
                    </Button>
                    <DeleteButton
                      action={() => deleteOrder(o.id)}
                      confirmText={`'${o.order_no ?? "sipariş"}' silinsin mi?`}
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
