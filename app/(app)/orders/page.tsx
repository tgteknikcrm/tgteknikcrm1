import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import {
  type PurchaseOrder,
  type Supplier,
} from "@/lib/supabase/types";
import { Plus, ShoppingCart } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { OrderDialog } from "./order-dialog";
import { OrdersTable } from "./orders-table";

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
            <OrdersTable orders={orders} />
          )}
        </CardContent>
      </Card>
    </>
  );
}
