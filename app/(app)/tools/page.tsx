import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import {
  type Tool,
  type Supplier,
} from "@/lib/supabase/types";
import { Plus, Wrench, Truck, ShoppingCart } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { SearchInput } from "@/components/app/search-input";
import { ToolDialog } from "./tool-dialog";
import { ToolsTable } from "./tools-table";
import { SupplierDialog } from "../suppliers/supplier-dialog";
import { OrderDialog } from "../orders/order-dialog";

export const metadata = { title: "Takım Listesi" };

export default async function ToolsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  let tools: Tool[] = [];
  let suppliers: Pick<Supplier, "id" | "name">[] = [];

  try {
    const supabase = await createClient();
    let query = supabase.from("tools").select("*").order("name");
    if (q) {
      query = query.or(
        `name.ilike.%${q}%,code.ilike.%${q}%,type.ilike.%${q}%,location.ilike.%${q}%`,
      );
    }
    const [toolsRes, suppliersRes] = await Promise.all([
      query,
      supabase.from("suppliers").select("id, name").eq("active", true).order("name"),
    ]);
    tools = toolsRes.data ?? [];
    suppliers = suppliersRes.data ?? [];
  } catch {
    /* not configured */
  }

  return (
    <>
      <PageHeader
        title="Takım Listesi"
        description="Kullanılan tüm takım, bıçak ve araç-gereçler"
        actions={
          <>
            <SearchInput placeholder="Takım ara..." />
            <SupplierDialog
              trigger={
                <Button variant="outline">
                  <Truck className="size-4" /> Tedarikçi Ekle
                </Button>
              }
            />
            <OrderDialog
              suppliers={suppliers}
              defaultCategory="takim"
              trigger={
                <Button variant="outline">
                  <ShoppingCart className="size-4" /> Sipariş Oluştur
                </Button>
              }
            />
            <ToolDialog
              trigger={
                <Button>
                  <Plus className="size-4" /> Yeni Takım
                </Button>
              }
            />
          </>
        }
      />

      <Card>
        <CardContent className="p-0">
          {tools.length === 0 ? (
            <EmptyState
              icon={Wrench}
              title={q ? "Eşleşen takım yok" : "Henüz takım yok"}
              description={q ? "Arama terimini değiştirin." : "İlk takımı ekleyerek envanterini oluştur."}
            />
          ) : (
            <ToolsTable tools={tools} suppliers={suppliers} />
          )}
        </CardContent>
      </Card>
    </>
  );
}
