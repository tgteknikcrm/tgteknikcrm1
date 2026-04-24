import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  PO_ITEM_CATEGORY_LABEL,
  PO_ITEM_PRESETS,
  PO_STATUS_LABEL,
  PO_STATUS_TONE,
  type PurchaseOrder,
  type PurchaseOrderItem,
  type Supplier,
} from "@/lib/supabase/types";
import { ArrowLeft, Pencil } from "lucide-react";
import { OrderDialog } from "../order-dialog";
import { formatDate, cn } from "@/lib/utils";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [orderRes, suppliersRes] = await Promise.all([
    supabase
      .from("purchase_orders")
      .select(`*, supplier:suppliers(id, name)`)
      .eq("id", id)
      .single(),
    supabase
      .from("suppliers")
      .select("id, name")
      .eq("active", true)
      .order("name"),
  ]);

  if (orderRes.error || !orderRes.data) notFound();
  const order = orderRes.data as PurchaseOrder & {
    supplier: Pick<Supplier, "id" | "name"> | null;
  };

  const itemsRes = await supabase
    .from("purchase_order_items")
    .select("*")
    .eq("order_id", id)
    .order("created_at");
  const items = (itemsRes.data ?? []) as PurchaseOrderItem[];

  const total = items.reduce(
    (s, it) => s + Number(it.quantity ?? 0) * Number(it.unit_price ?? 0),
    0,
  );

  return (
    <>
      <PageHeader
        title={order.order_no || "Sipariş"}
        description={
          order.supplier?.name
            ? `${order.supplier.name} · ${formatDate(order.order_date)}`
            : formatDate(order.order_date)
        }
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/orders">
                <ArrowLeft className="size-4" /> Geri
              </Link>
            </Button>
            <OrderDialog
              suppliers={suppliersRes.data ?? []}
              order={{ ...order, items }}
              trigger={
                <Button>
                  <Pencil className="size-4" /> Düzenle
                </Button>
              }
            />
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-medium">
              Durum
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge
              variant="outline"
              className={cn("border text-sm", PO_STATUS_TONE[order.status])}
            >
              {PO_STATUS_LABEL[order.status]}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-medium">
              Beklenen Teslim
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {order.expected_date ? formatDate(order.expected_date) : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-medium">
              Toplam
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold tabular-nums">
              {total > 0
                ? total.toLocaleString("tr-TR", {
                    style: "currency",
                    currency: "TRY",
                    maximumFractionDigits: 2,
                  })
                : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Kalemler ({items.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6 text-center">
              Bu siparişte kalem yok.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Açıklama</TableHead>
                  <TableHead className="text-right">Miktar</TableHead>
                  <TableHead>Birim</TableHead>
                  <TableHead className="text-right">Birim Fiyat</TableHead>
                  <TableHead className="text-right">Tutar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it) => {
                  const preset = PO_ITEM_PRESETS.find((p) => p.category === it.category);
                  const line =
                    Number(it.quantity ?? 0) * Number(it.unit_price ?? 0);
                  return (
                    <TableRow key={it.id}>
                      <TableCell>
                        <Badge variant="outline" className="gap-1 font-normal">
                          <span>{preset?.emoji}</span>
                          {PO_ITEM_CATEGORY_LABEL[it.category]}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{it.description}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Number(it.quantity).toLocaleString("tr-TR")}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {it.unit}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {it.unit_price !== null
                          ? Number(it.unit_price).toLocaleString("tr-TR", {
                              style: "currency",
                              currency: "TRY",
                            })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">
                        {line > 0
                          ? line.toLocaleString("tr-TR", {
                              style: "currency",
                              currency: "TRY",
                            })
                          : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {order.notes && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-sm">Notlar</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">
            {order.notes}
          </CardContent>
        </Card>
      )}
    </>
  );
}
