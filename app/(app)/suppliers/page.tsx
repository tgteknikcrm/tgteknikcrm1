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
import type { Supplier } from "@/lib/supabase/types";
import { Plus, Truck } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { SupplierDialog } from "./supplier-dialog";
import { DeleteButton } from "../operators/delete-button";
import { deleteSupplier } from "./actions";

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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tedarikçi</TableHead>
                  <TableHead>Yetkili</TableHead>
                  <TableHead>Telefon</TableHead>
                  <TableHead>E-posta</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.contact_person || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-sm">
                      {s.phone || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {s.email || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.active ? "default" : "secondary"}>
                        {s.active ? "Aktif" : "Pasif"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <SupplierDialog
                          supplier={s}
                          trigger={
                            <Button variant="ghost" size="sm">
                              Düzenle
                            </Button>
                          }
                        />
                        <DeleteButton
                          action={async () => {
                            "use server";
                            return deleteSupplier(s.id);
                          }}
                          confirmText={`'${s.name}' tedarikçisi silinsin mi?`}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
