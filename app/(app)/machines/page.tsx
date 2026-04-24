import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import {
  MACHINE_STATUS_COLOR,
  MACHINE_STATUS_LABEL,
  type Machine,
} from "@/lib/supabase/types";
import { Factory, ArrowRight, Plus } from "lucide-react";
import Link from "next/link";
import { MachineDialog } from "./machine-dialog";
import { DeleteButton } from "../operators/delete-button";
import { deleteMachine } from "./actions";

export const metadata = { title: "Makineler" };

export default async function MachinesPage() {
  let machines: Machine[] = [];
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("machines").select("*").order("name");
    machines = data ?? [];
  } catch {
    /* Supabase not configured yet */
  }

  return (
    <>
      <PageHeader
        title="Makineler"
        description="Tüm CNC tezgahları ve anlık durumları"
        actions={
          <MachineDialog
            trigger={
              <Button>
                <Plus className="size-4" /> Yeni Makine
              </Button>
            }
          />
        }
      />

      {machines.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-sm text-muted-foreground py-12">
            <Factory className="size-8 mx-auto mb-3 opacity-50" />
            Henüz makine yok. SQL migration çalıştırıldığında Fanuc, Tekna-1,
            Tekna-2 ve BWX otomatik eklenir.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {machines.map((m) => (
            <Card key={m.id} className="group hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="size-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Factory className="size-6 text-primary" />
                  </div>
                  <Badge variant="outline" className="gap-1.5">
                    <span className={`size-2 rounded-full ${MACHINE_STATUS_COLOR[m.status]}`} />
                    {MACHINE_STATUS_LABEL[m.status]}
                  </Badge>
                </div>
                <h3 className="font-semibold text-lg">{m.name}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {m.type}
                  {m.model ? ` · ${m.model}` : ""}
                </p>
                {m.location && (
                  <p className="text-xs text-muted-foreground mt-2">
                    📍 {m.location}
                  </p>
                )}
                <div className="flex gap-2 mt-4">
                  <Button asChild variant="outline" size="sm" className="flex-1">
                    <Link href={`/machines/${m.id}`}>
                      Detay <ArrowRight className="size-3.5" />
                    </Link>
                  </Button>
                  <MachineDialog
                    machine={m}
                    trigger={
                      <Button variant="ghost" size="sm">
                        Düzenle
                      </Button>
                    }
                  />
                  <DeleteButton
                    action={async () => {
                      "use server";
                      return deleteMachine(m.id);
                    }}
                    confirmText={`'${m.name}' makinesi silinsin mi? Bu işleme bağlı üretim kayıtları varsa engellenebilir.`}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
