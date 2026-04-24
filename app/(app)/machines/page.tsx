import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/server";
import {
  MACHINE_STATUS_LABEL,
  MACHINE_STATUS_TONE,
  SHIFT_LABEL,
  getCurrentShift,
  type Machine,
  type Shift,
} from "@/lib/supabase/types";
import { Factory, ArrowRight, Plus, User as UserIcon } from "lucide-react";
import Link from "next/link";
import { MachineDialog } from "./machine-dialog";
import { DeleteButton } from "../operators/delete-button";
import { deleteMachine } from "./actions";
import { cn } from "@/lib/utils";

export const metadata = { title: "Makineler" };

type AssignmentRow = {
  machine_id: string;
  shift: Shift;
  operator: { id: string; full_name: string; employee_no: string | null } | null;
};

export default async function MachinesPage() {
  let machines: Machine[] = [];
  let assignments: AssignmentRow[] = [];
  try {
    const supabase = await createClient();
    const [machinesRes, assignmentsRes] = await Promise.all([
      supabase.from("machines").select("*").order("name"),
      supabase
        .from("machine_shift_assignments")
        .select(`machine_id, shift, operator:operators(id, full_name, employee_no)`),
    ]);
    machines = machinesRes.data ?? [];
    assignments = (assignmentsRes.data ?? []) as unknown as AssignmentRow[];
  } catch {
    /* Supabase not configured yet */
  }

  const currentShift = getCurrentShift();
  const assignedByMachine = new Map<string, Map<Shift, AssignmentRow>>();
  for (const a of assignments) {
    if (!assignedByMachine.has(a.machine_id)) {
      assignedByMachine.set(a.machine_id, new Map());
    }
    assignedByMachine.get(a.machine_id)!.set(a.shift, a);
  }

  return (
    <>
      <PageHeader
        title="Makineler"
        description="Tüm CNC tezgahları, anlık durumları ve vardiya operatörleri"
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
          {machines.map((m) => {
            const tone = MACHINE_STATUS_TONE[m.status];
            const currentAssign = assignedByMachine.get(m.id)?.get(currentShift);
            const assignedShifts = assignedByMachine.get(m.id);
            return (
              <Card
                key={m.id}
                className="group hover:shadow-md transition-shadow overflow-hidden gap-0 py-0"
              >
                <div className={cn("h-1 w-full", tone.dot)} />
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="size-11 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Factory className="size-5 text-primary" />
                    </div>
                    <Badge
                      variant="outline"
                      className={cn("gap-1.5 font-medium border", tone.badge)}
                    >
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          tone.dot,
                          m.status === "aktif" && "animate-pulse",
                        )}
                      />
                      {MACHINE_STATUS_LABEL[m.status]}
                    </Badge>
                  </div>
                  <h3 className="font-bold text-lg tracking-tight">{m.name}</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {m.type}
                    {m.model ? ` · ${m.model}` : ""}
                  </p>
                  {m.location && (
                    <p className="text-xs text-muted-foreground mt-1">
                      📍 {m.location}
                    </p>
                  )}

                  {/* Current shift operator */}
                  <div className="mt-4 pt-4 border-t">
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                      {SHIFT_LABEL[currentShift]} vardiyası · şu an
                    </div>
                    {currentAssign?.operator ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="size-8">
                          <AvatarFallback className="text-[11px] font-semibold bg-primary/15 text-primary">
                            {currentAssign.operator.full_name
                              .split(" ")
                              .map((s) => s[0])
                              .slice(0, 2)
                              .join("")
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate leading-tight">
                            {currentAssign.operator.full_name}
                          </div>
                          {currentAssign.operator.employee_no && (
                            <div className="text-[10px] text-muted-foreground font-mono">
                              {currentAssign.operator.employee_no}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <UserIcon className="size-3.5" />
                        Atanmamış
                      </div>
                    )}
                    {assignedShifts && assignedShifts.size > 0 && (
                      <div className="text-[10px] text-muted-foreground mt-1.5">
                        Toplam {assignedShifts.size} vardiya atanmış
                      </div>
                    )}
                  </div>

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
            );
          })}
        </div>
      )}
    </>
  );
}
