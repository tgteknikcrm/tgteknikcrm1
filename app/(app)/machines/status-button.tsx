"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { ChevronDown, Loader2, Check } from "lucide-react";
import { updateMachineStatus } from "./actions";
import {
  MACHINE_STATUS_LABEL,
  MACHINE_STATUS_TONE,
  type DowntimeReasonCategory,
  type MachineStatus,
} from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { DowntimeReasonDialog } from "./downtime-reason-dialog";

const STATUSES: MachineStatus[] = ["aktif", "durus", "bakim", "ariza"];

interface Props {
  machineId: string;
  machineName?: string;
  current: MachineStatus;
}

export function StatusButton({ machineId, machineName, current }: Props) {
  const [pending, startTransition] = useTransition();
  const [reasonDialog, setReasonDialog] =
    useState<Extract<MachineStatus, "durus" | "bakim" | "ariza"> | null>(null);
  const tone = MACHINE_STATUS_TONE[current];

  function applyStatus(
    next: MachineStatus,
    reasonCategory?: DowntimeReasonCategory,
    reasonText?: string,
  ) {
    startTransition(async () => {
      const r = await updateMachineStatus(machineId, next, {
        reasonCategory,
        reasonText,
      });
      if (r.error) toast.error(r.error);
      else toast.success(`Durum: ${MACHINE_STATUS_LABEL[next]}`);
    });
  }

  function onSelect(next: MachineStatus) {
    if (next === current) return;
    // Going from aktif → non-aktif → ask for reason first.
    if (
      current === "aktif" &&
      (next === "durus" || next === "bakim" || next === "ariza")
    ) {
      setReasonDialog(next);
      return;
    }
    applyStatus(next);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            disabled={pending}
            className={cn("gap-2 font-medium border-2", tone.badge)}
          >
            <span className={cn("size-2 rounded-full", tone.dot)} />
            Durum: {MACHINE_STATUS_LABEL[current]}
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ChevronDown className="size-3.5" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-wider">
            Makine Durumu
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {STATUSES.map((s) => {
            const t = MACHINE_STATUS_TONE[s];
            const isCurrent = s === current;
            return (
              <DropdownMenuItem
                key={s}
                onSelect={() => onSelect(s)}
                className="gap-2 cursor-pointer"
              >
                <span className={cn("size-2 rounded-full shrink-0", t.dot)} />
                <span className="flex-1 font-medium">{MACHINE_STATUS_LABEL[s]}</span>
                {isCurrent && <Check className="size-3.5 text-primary" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {reasonDialog && (
        <DowntimeReasonDialog
          open={!!reasonDialog}
          onOpenChange={(v) => {
            if (!v) setReasonDialog(null);
          }}
          status={reasonDialog}
          machineName={machineName}
          onConfirm={(cat, text) => {
            applyStatus(reasonDialog, cat, text);
            setReasonDialog(null);
          }}
        />
      )}
    </>
  );
}
