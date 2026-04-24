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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { saveMachine } from "./actions";
import {
  MACHINE_STATUS_LABEL,
  type Machine,
  type MachineStatus,
  type MachineType,
} from "@/lib/supabase/types";
import { Loader2 } from "lucide-react";

interface Props {
  machine?: Machine;
  trigger: React.ReactNode;
}

const TYPES: MachineType[] = ["Fanuc", "Tekna", "BWX", "Diger"];
const STATUSES: MachineStatus[] = ["aktif", "durus", "bakim", "ariza"];

export function MachineDialog({ machine, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState(machine?.name ?? "");
  const [type, setType] = useState<MachineType>(machine?.type ?? "Fanuc");
  const [status, setStatus] = useState<MachineStatus>(machine?.status ?? "aktif");
  const [model, setModel] = useState(machine?.model ?? "");
  const [serialNo, setSerialNo] = useState(machine?.serial_no ?? "");
  const [location, setLocation] = useState(machine?.location ?? "");
  const [notes, setNotes] = useState(machine?.notes ?? "");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await saveMachine({
        id: machine?.id,
        name,
        type,
        status,
        model,
        serial_no: serialNo,
        location,
        notes,
      });
      if (result.error) toast.error(result.error);
      else {
        toast.success(machine ? "Makine güncellendi" : "Makine eklendi");
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {machine ? "Makine Düzenle" : "Yeni Makine"}
          </DialogTitle>
          <DialogDescription>
            Makine bilgilerini doldurun. Zorunlu alanlar yıldızlıdır.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="name">İsim *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="type">Tip *</Label>
              <Select value={type} onValueChange={(v) => setType(v as MachineType)}>
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="model">Model</Label>
              <Input id="model" value={model} onChange={(e) => setModel(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="serial">Seri No</Label>
              <Input id="serial" value={serialNo} onChange={(e) => setSerialNo(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="status">Durum *</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as MachineStatus)}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {MACHINE_STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="location">Konum</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="ör. Atölye 1"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notlar</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              İptal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {machine ? "Kaydet" : "Ekle"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
