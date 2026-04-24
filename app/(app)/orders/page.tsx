import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import {
  PO_STATUS_LABEL,
  PO_STATUS_TONE,
  type PurchaseOrder,
  type Supplier,
} from "@/lib/supabase/types";
import { Plus, ShoppingCart } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { OrderDialog } from "./order-dialog";
import { DeleteButton } from "../operators/delete-button";
import { deleteOrder } from "./actions";
import { formatDate, cn } from "@/lib/utils";

export const metadata = { title: "Siparişler" };

type OrderRow = PurchaseOrder & {
  supplier: Pick<Supplier, "id" | "name"> | null;
  items: { quantity: number; unit_price: number | null }[];
};

export default async function OrdersPage() {
  let orders: OrderRow[] = [];
  let suppliers: Pick<Supplier, "id" | "name">[] = [];
  try {
    const supabase = await createClient();
    const [ordersRes, suppliersRes] = await Promise.all([
      supabase
        .from("purchase_orders")
        .select(
          `*, supplier:suppliers(id, name),
           items:purchase_order_items(quantity, unit_price)`,
        )
        .order("order_date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("suppliers")
        .select("id, name")
        .eq("active", true)
        .order("name"),
    ]);
    orders = (ordersRes.data ?? []) as unknown as OrderRow[];
    suppliers = suppliersRes.data ?? [];
  } catch {
    /* not configured */
  }

  return (
    <>
      <PageHeader
        title="Siparişler"
        description="Tedarikçilere verilen satın alma siparişleri"
        actions={
          <OrderDialog
            suppliers={suppliers}
            trigger={
              <Button>
                <Plus className="size-4" /> Yeni Sipariş
              </Button>
            }
          />
        }
      />

      <Card>
        <CardContent className="p-0">
          {orders.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title="Henüz sipariş yok"
              description="Tedarikçiye gönderilecek ilk siparişi oluştur."
              action={
                <OrderDialog
                  suppliers={suppliers}
                  trigger={
                    <Button>
                      <Plus className="size-4" /> Sipariş Oluştur
                    </Button>
                  }
                />
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
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
                    <TableRow key={o.id}>
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
                            action={async () => {
                              "use server";
                              return deleteOrder(o.id);
                            }}
                            confirmText={`'${o.order_no ?? "sipariş"}' silinsin mi?`}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
