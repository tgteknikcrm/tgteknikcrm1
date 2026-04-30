import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import type { Supplier } from "@/lib/supabase/types";
import { Plus, Truck } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { SupplierDialog } from "./supplier-dialog";
import { SuppliersTable } from "./suppliers-table";

export const metadata = { title: "Tedarikçiler" };

export default async function SuppliersPage() {
  let suppliers: Supplier[] = [];
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("suppliers").select("*").order("name");
    suppliers = data ?? [];
  } catch {
    /* not configured */
  }

  return (
    <>
      <PageHeader
        title="Tedarikçiler"
        description="Sipariş verdiğin firmalar"
        actions={
          <SupplierDialog
            trigger={
              <Button>
                <Plus className="size-4" /> Yeni Tedarikçi
              </Button>
            }
          />
        }
      />

      <Card>
        <CardContent className="p-0">
          {suppliers.length === 0 ? (
            <EmptyState
              icon={Truck}
              title="Henüz tedarikçi yok"
              description="Sipariş verdiğin ilk firmayı ekleyerek başla."
              action={
                <SupplierDialog
                  trigger={
                    <Button>
                      <Plus className="size-4" /> Tedarikçi Ekle
                    </Button>
                  }
                />
              }
            />
          ) : (
            <SuppliersTable suppliers={suppliers} />
          )}
        </CardContent>
      </Card>
    </>
  );
}
