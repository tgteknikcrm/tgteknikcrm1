"use client";

import { useTransition } from "react";
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
  type MachineStatus,
} from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

const STATUSES: MachineStatus[] = ["aktif", "durus", "bakim", "ariza"];

interface Props {
  machineId: string;
  current: MachineStatus;
}

export function StatusButton({ machineId, current }: Props) {
  const [pending, startTransition] = useTransition();
  const tone = MACHINE_STATUS_TONE[current];

  function onSelect(next: MachineStatus) {
    if (next === current) return;
    startTransition(async () => {
      const r = await updateMachineStatus(machineId, next);
      if (r.error) toast.error(r.error);
      else toast.success(`Durum: ${MACHINE_STATUS_LABEL[next]}`);
    });
  }

  return (
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
  );
}
