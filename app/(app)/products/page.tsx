import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import type {
  Product,
  ProductImage,
  ProductTool,
} from "@/lib/supabase/types";
import { EmptyState } from "@/components/app/empty-state";
import { Boxes, Plus } from "lucide-react";
import { ProductsTable } from "./products-table";

export const metadata = { title: "Ürünler" };

export default async function ProductsPage() {
  const supabase = await createClient();
  const [pRes, ptRes, piRes] = await Promise.all([
    supabase.from("products").select("*").order("code", { ascending: true }),
    supabase.from("product_tools").select("*"),
    supabase
      .from("product_images")
      .select("product_id, image_path, is_primary, sort_order")
      .eq("is_primary", true),
  ]);
  const products = (pRes.data ?? []) as Product[];
  const productTools = (ptRes.data ?? []) as ProductTool[];
  const primaryImages = (piRes.data ?? []) as Pick<
    ProductImage,
    "product_id" | "image_path" | "is_primary" | "sort_order"
  >[];

  return (
    <>
      <PageHeader
        title="Ürünler"
        description="Tekrar eden parça/ürün kütüphanesi · Kapsamlı master kayıt"
        actions={
          <Button asChild>
            <Link href="/products/new">
              <Plus className="size-4" /> Yeni Ürün
            </Link>
          </Button>
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
                <Button asChild>
                  <Link href="/products/new">
                    <Plus className="size-4" /> İlk Ürünü Ekle
                  </Link>
                </Button>
              }
            />
          ) : (
            <ProductsTable
              products={products}
              productTools={productTools}
              primaryImages={primaryImages}
            />
          )}
        </CardContent>
      </Card>
    </>
  );
}
