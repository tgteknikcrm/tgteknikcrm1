import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { type Operator } from "@/lib/supabase/types";
import { Plus, Users } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { OperatorDialog } from "./operator-dialog";
import { OperatorsTable } from "./operators-table";

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
            <OperatorsTable operators={operators} />
          )}
        </CardContent>
      </Card>
    </>
  );
}
