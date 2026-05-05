"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Pause, AlertOctagon, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DOWNTIME_REASON_LABEL,
  DOWNTIME_REASONS_BY_STATUS,
  MACHINE_STATUS_LABEL,
  type DowntimeReasonCategory,
  type MachineStatus,
} from "@/lib/supabase/types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** durus / bakim / ariza — hangi durum için sebep alınıyor. */
  status: Extract<MachineStatus, "durus" | "bakim" | "ariza">;
  machineName?: string;
  /** Onaylandığında çağrılır. Opsiyonel: kullanıcı atlarsa null geçer. */
  onConfirm: (
    reasonCategory: DowntimeReasonCategory,
    reasonText: string,
  ) => void;
}

const STATUS_ICON: Record<Props["status"], typeof Pause> = {
  durus: Pause,
  bakim: Wrench,
  ariza: AlertOctagon,
};

const STATUS_TONE: Record<Props["status"], string> = {
  durus: "text-zinc-700 dark:text-zinc-300 bg-zinc-500/15",
  bakim: "text-amber-700 dark:text-amber-300 bg-amber-500/15",
  ariza: "text-red-700 dark:text-red-300 bg-red-500/15",
};

export function DowntimeReasonDialog({
  open,
  onOpenChange,
  status,
  machineName,
  onConfirm,
}: Props) {
  const [category, setCategory] = useState<DowntimeReasonCategory | null>(null);
  const [text, setText] = useState("");

  useEffect(() => {
    if (!open) {
      setCategory(null);
      setText("");
    }
  }, [open]);

  const Icon = STATUS_ICON[status];
  const tone = STATUS_TONE[status];
  const presets = DOWNTIME_REASONS_BY_STATUS[status];

  function onSave() {
    if (!category) return;
    onConfirm(category, text);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <span
              className={cn(
                "size-9 rounded-lg flex items-center justify-center",
                tone,
              )}
            >
              <Icon className="size-5" />
            </span>
            {MACHINE_STATUS_LABEL[status]} sebebi nedir?
          </DialogTitle>
          <DialogDescription>
            {machineName
              ? `'${machineName}' durdu. Pareto/MTBF raporları için sebep işaretle.`
              : "Pareto / MTBF raporları için sebep kategorisi gerekli."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label className="text-base font-semibold">Kategori</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {presets.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={cn(
                    "text-left px-3 py-2 rounded-lg border text-sm transition",
                    category === c
                      ? "bg-primary/10 border-primary text-primary font-medium"
                      : "border-muted hover:border-primary/40 hover:bg-muted/40",
                  )}
                >
                  {DOWNTIME_REASON_LABEL[c]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              Açıklama{" "}
              <span className="text-muted-foreground font-normal">
                ({category === "diger" ? "zorunlu" : "opsiyonel"})
              </span>
            </Label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
              placeholder={
                status === "ariza"
                  ? "Örn: X-eksen kayışı koptu, parça değişimi gerek"
                  : status === "bakim"
                    ? "Örn: Hidrolik yağ değişimi"
                    : "Örn: Yemek molası, 13:00'te dönülecek"
              }
              className="text-sm"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            İptal
          </Button>
          <Button
            type="button"
            disabled={
              !category || (category === "diger" && text.trim().length === 0)
            }
            onClick={onSave}
          >
            Onayla & Durumu Değiştir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
