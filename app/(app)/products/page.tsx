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
import type { Product, ProductTool, Tool } from "@/lib/supabase/types";
import { EmptyState } from "@/components/app/empty-state";
import { Boxes, Plus, Wrench } from "lucide-react";
import { ProductDialog } from "./product-dialog";
import { DeleteButton } from "../operators/delete-button";
import { deleteProduct } from "./actions";

export const metadata = { title: "Ürünler" };

export default async function ProductsPage() {
  const supabase = await createClient();
  const [pRes, tRes, ptRes] = await Promise.all([
    supabase
      .from("products")
      .select("*")
      .order("code", { ascending: true }),
    supabase.from("tools").select("*").order("name"),
    supabase.from("product_tools").select("*"),
  ]);
  const products = (pRes.data ?? []) as Product[];
  const tools = (tRes.data ?? []) as Tool[];
  const productTools = (ptRes.data ?? []) as ProductTool[];

  const toolCountByProduct = new Map<string, number>();
  for (const pt of productTools) {
    toolCountByProduct.set(
      pt.product_id,
      (toolCountByProduct.get(pt.product_id) ?? 0) + 1,
    );
  }

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
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
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
                    <TableRow key={p.id}>
                      <TableCell className="font-mono font-bold">
                        {p.code}
                      </TableCell>
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
                          <Badge
                            variant="outline"
                            className="font-normal gap-1"
                          >
                            <Wrench className="size-3" />
                            {productPt.length}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            —
                          </span>
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
                            action={async () => {
                              "use server";
                              return deleteProduct(p.id);
                            }}
                            confirmText={`'${p.code}' ürünü silinsin mi? Bağlı işler/teknik resimler etkilenmez (sadece ürün referansı kaldırılır).`}
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
