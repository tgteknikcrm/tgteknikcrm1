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
import { SHIFT_LABEL, type Operator } from "@/lib/supabase/types";
import { Plus, Users } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { OperatorDialog } from "./operator-dialog";
import { DeleteButton } from "./delete-button";
import { deleteOperator } from "./actions";

export const metadata = { title: "Operatörler" };

export default async function OperatorsPage() {
  let operators: Operator[] = [];
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("operators").select("*").order("full_name");
    operators = data ?? [];
  } catch {
    /* not configured */
  }

  return (
    <>
      <PageHeader
        title="Operatörler"
        description="Tezgah başında görev yapan operatörler"
        actions={
          <OperatorDialog
            trigger={
              <Button>
                <Plus className="size-4" /> Yeni Operatör
              </Button>
            }
          />
        }
      />

      <Card>
        <CardContent className="p-0">
          {operators.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Henüz operatör yok"
              description="İlk operatörü ekleyerek başlayın."
              action={
                <OperatorDialog
                  trigger={
                    <Button>
                      <Plus className="size-4" /> Operatör Ekle
                    </Button>
                  }
                />
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ad Soyad</TableHead>
                  <TableHead>Sicil</TableHead>
                  <TableHead>Telefon</TableHead>
                  <TableHead>Vardiya</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {operators.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.full_name}</TableCell>
                    <TableCell className="text-muted-foreground">{o.employee_no || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{o.phone || "—"}</TableCell>
                    <TableCell>{o.shift ? SHIFT_LABEL[o.shift] : "—"}</TableCell>
                    <TableCell>
                      <Badge variant={o.active ? "default" : "secondary"}>
                        {o.active ? "Aktif" : "Pasif"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <OperatorDialog
                          operator={o}
                          trigger={
                            <Button variant="ghost" size="sm">
                              Düzenle
                            </Button>
                          }
                        />
                        <DeleteButton
                          action={async () => {
                            "use server";
                            return deleteOperator(o.id);
                          }}
                          confirmText={`'${o.full_name}' silinsin mi?`}
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
