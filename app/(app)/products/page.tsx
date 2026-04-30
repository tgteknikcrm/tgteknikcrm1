import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import type { Product, ProductTool, Tool } from "@/lib/supabase/types";
import { EmptyState } from "@/components/app/empty-state";
import { Boxes, Plus } from "lucide-react";
import { ProductDialog } from "./product-dialog";
import { ProductsTable } from "./products-table";

export const metadata = { title: "Ürünler" };

export default async function ProductsPage() {
  const supabase = await createClient();
  const [pRes, tRes, ptRes] = await Promise.all([
    supabase.from("products").select("*").order("code", { ascending: true }),
    supabase.from("tools").select("*").order("name"),
    supabase.from("product_tools").select("*"),
  ]);
  const products = (pRes.data ?? []) as Product[];
  const tools = (tRes.data ?? []) as Tool[];
  const productTools = (ptRes.data ?? []) as ProductTool[];

  return (
    <>
      <PageHeader
        title="Ürünler"
        description="Tekrar eden parça/ürün kütüphanesi · İş açarken otomatik takım atama"
        actions={
          <ProductDialog
            tools={tools}
            trigger={
              <Button>
                <Plus className="size-4" /> Yeni Ürün
              </Button>
            }
          />
        }
      />

      <Card>
        <CardContent className="p-0">
          {products.length === 0 ? (
            <EmptyState
              icon={Boxes}
              title="Henüz ürün yok"
              description="Tekrar eden parçaları burada tanımla. İş açarken bu üründen seçince teknik resim, takım, CAD/CAM otomatik atanır."
              action={
                <ProductDialog
                  tools={tools}
                  trigger={
                    <Button>
                      <Plus className="size-4" /> İlk Ürünü Ekle
                    </Button>
                  }
                />
              }
            />
          ) : (
            <ProductsTable
              products={products}
              tools={tools}
              productTools={productTools}
            />
          )}
        </CardContent>
      </Card>
    </>
  );
}
