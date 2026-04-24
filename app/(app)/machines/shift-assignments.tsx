"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Sunrise, Sunset, Moon, X } from "lucide-react";
import {
  SHIFT_LABEL,
  getCurrentShift,
  type Shift,
  type MachineShiftAssignment,
  type Operator,
} from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { assignOperator, clearAssignment } from "./assignments-actions";

const SHIFTS: Shift[] = ["sabah", "aksam", "gece"];

const SHIFT_META: Record<
  Shift,
  { icon: typeof Sunrise; hours: string; tone: string }
> = {
  sabah: {
    icon: Sunrise,
    hours: "08:00 — 16:00",
    tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  },
  aksam: {
    icon: Sunset,
    hours: "16:00 — 24:00",
    tone: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
  },
  gece: {
    icon: Moon,
    hours: "00:00 — 08:00",
    tone: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
  },
};

type AssignmentRow = MachineShiftAssignment & {
  operator: Pick<Operator, "id" | "full_name" | "employee_no" | "phone"> | null;
};

interface Props {
  machineId: string;
  assignments: AssignmentRow[];
  operators: Pick<Operator, "id" | "full_name" | "employee_no" | "phone" | "shift" | "active">[];
}

export function ShiftAssignments({ machineId, assignments, operators }: Props) {
  const currentShift = getCurrentShift();
  const byShift = new Map<Shift, AssignmentRow>(
    assignments.map((a) => [a.shift, a]),
  );

  return (
    <div className="space-y-2">
      {SHIFTS.map((s) => {
        const meta = SHIFT_META[s];
        const a = byShift.get(s);
        const isNow = s === currentShift;
        const Icon = meta.icon;
        return (
          <div
            key={s}
            className={cn(
              "flex items-center gap-3 p-3 rounded-lg border transition",
              isNow && "ring-2 ring-primary/30 shadow-sm",
            )}
          >
            <div
              className={cn(
                "size-10 rounded-lg flex items-center justify-center border shrink-0",
                meta.tone,
              )}
            >
              <Icon className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{SHIFT_LABEL[s]}</span>
                {isNow && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                    şu an
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground font-mono">
                {meta.hours}
              </div>
            </div>

            {a?.operator ? (
              <AssignedOperator
                machineId={machineId}
                assignment={a}
                operators={operators}
              />
            ) : (
              <AssignDialog
                machineId={machineId}
                shift={s}
                operators={operators}
                trigger={
                  <Button variant="outline" size="sm" className="gap-1">
                    <Plus className="size-3.5" />
                    Operatör Ata
                  </Button>
                }
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function AssignedOperator({
  machineId,
  assignment,
  operators,
}: {
  machineId: string;
  assignment: AssignmentRow;
  operators: Props["operators"];
}) {
  const [pending, startTransition] = useTransition();
  const op = assignment.operator!;
  const initials = op.full_name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  function onClear() {
    if (!confirm(`${op.full_name} atamasını kaldır?`)) return;
    startTransition(async () => {
      const r = await clearAssignment(assignment.id, machineId);
      if (r.error) toast.error(r.error);
      else toast.success("Atama kaldırıldı");
    });
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2 rounded-md px-2 py-1.5 bg-muted/50">
        <Avatar className="size-7">
          <AvatarFallback className="text-[10px] font-semibold bg-primary/15 text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 text-right">
          <div className="text-sm font-medium leading-tight truncate max-w-[10rem]">
            {op.full_name}
          </div>
          {op.employee_no && (
            <div className="text-[10px] text-muted-foreground font-mono">
              {op.employee_no}
            </div>
          )}
        </div>
      </div>
      <AssignDialog
        machineId={machineId}
        shift={assignment.shift}
        operators={operators}
        existingOperatorId={assignment.operator_id}
        existingNotes={assignment.notes ?? ""}
        trigger={
          <Button variant="ghost" size="icon" className="size-8" title="Değiştir">
            <Pencil className="size-3.5" />
          </Button>
        }
      />
      <Button
        variant="ghost"
        size="icon"
        className="size-8 text-muted-foreground hover:text-destructive"
        onClick={onClear}
        disabled={pending}
        title="Atamayı kaldır"
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
      </Button>
    </div>
  );
}

function AssignDialog({
  machineId,
  shift,
  operators,
  trigger,
  existingOperatorId,
  existingNotes,
}: {
  machineId: string;
  shift: Shift;
  operators: Props["operators"];
  trigger: React.ReactNode;
  existingOperatorId?: string;
  existingNotes?: string;
}) {
  const [open, setOpen] = useState(false);
  const [operatorId, setOperatorId] = useState(existingOperatorId ?? "");
  const [notes, setNotes] = useState(existingNotes ?? "");
  const [pending, startTransition] = useTransition();

  const eligible = operators.filter((o) => o.active);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!operatorId) {
      toast.error("Operatör seç.");
      return;
    }
    startTransition(async () => {
      const r = await assignOperator({
        machine_id: machineId,
        shift,
        operator_id: operatorId,
        notes,
      });
      if (r.error) toast.error(r.error);
      else {
        toast.success("Operatör atandı");
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {existingOperatorId ? "Operatörü Değiştir" : "Operatör Ata"}
          </DialogTitle>
          <DialogDescription>
            {SHIFT_LABEL[shift]} vardiyası için bu makineye operatör belirle.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="op">Operatör *</Label>
            <Select value={operatorId} onValueChange={setOperatorId}>
              <SelectTrigger id="op">
                <SelectValue placeholder="Operatör seç" />
              </SelectTrigger>
              <SelectContent>
                {eligible.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    Aktif operatör yok.
                  </div>
                ) : (
                  eligible.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.full_name}
                      {o.shift && ` · ${SHIFT_LABEL[o.shift]} vardiyası`}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Sadece aktif operatörler gösterilir. Yeni eklemek için sol menüden{" "}
              <span className="font-medium">Operatörler</span>.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Not (opsiyonel)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Örn. Geçici atama, nöbetçi operatör..."
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              İptal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {existingOperatorId ? "Kaydet" : "Ata"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
