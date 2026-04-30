"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Info,
  Hash,
  MapPin,
  Calendar,
  Factory,
  StickyNote,
} from "lucide-react";
import {
  MACHINE_STATUS_LABEL,
  type Machine,
} from "@/lib/supabase/types";
import { formatDateTime } from "@/lib/utils";

/**
 * Compact info popover for the machine detail page.
 * Replaces the old "Makine Bilgileri" card — same data, less visual
 * weight, opened on demand from an icon next to the machine name.
 */
export function MachineInfoDialog({ machine }: { machine: Machine }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 rounded-full text-muted-foreground hover:text-foreground"
          title="Makine bilgileri"
          aria-label="Makine bilgileri"
        >
          <Info className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Factory className="size-5 text-primary" />
            {machine.name}
          </DialogTitle>
          <DialogDescription>
            Detaylı makine bilgileri ve notlar.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 py-2">
          <Field icon={Factory} label="Tip" value={machine.type} />
          <Field
            icon={Hash}
            label="Durum"
            value={MACHINE_STATUS_LABEL[machine.status]}
          />
          <Field icon={Hash} label="Model" value={machine.model} mono />
          <Field
            icon={Hash}
            label="Seri No"
            value={machine.serial_no}
            mono
          />
          <Field icon={MapPin} label="Konum" value={machine.location} />
          <Field
            icon={Calendar}
            label="Son Güncelleme"
            value={formatDateTime(machine.updated_at)}
          />
        </div>

        {machine.notes && (
          <div className="rounded-lg border bg-muted/30 p-3 mt-1">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              <StickyNote className="size-3" /> Notlar
            </div>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">
              {machine.notes}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({
  icon: Icon,
  label,
  value,
  mono = false,
}: {
  icon: typeof Info;
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        <Icon className="size-3" /> {label}
      </div>
      <div className={mono ? "font-mono text-sm" : "text-sm font-medium"}>
        {value || <span className="text-muted-foreground italic">—</span>}
      </div>
    </div>
  );
}
