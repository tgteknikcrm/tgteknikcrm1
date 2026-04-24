"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
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
import { saveProductionEntry } from "./actions";
import {
  SHIFT_LABEL,
  type Job,
  type Machine,
  type Operator,
  type ProductionEntry,
  type Shift,
} from "@/lib/supabase/types";
import { Loader2 } from "lucide-react";

interface Props {
  entry?: ProductionEntry;
  machines: Machine[];
  operators: Operator[];
  jobs: Job[];
  trigger: React.ReactNode;
}

const SHIFTS: Shift[] = ["sabah", "aksam", "gece"];

export function EntryDialog({ entry, machines, operators, jobs, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const today = new Date().toISOString().slice(0, 10);

  const [entryDate, setEntryDate] = useState(entry?.entry_date ?? today);
  const [shift, setShift] = useState<Shift>(entry?.shift ?? "sabah");
  const [machineId, setMachineId] = useState(entry?.machine_id ?? machines[0]?.id ?? "");
  const [operatorId, setOperatorId] = useState(entry?.operator_id ?? "none");
  const [jobId, setJobId] = useState(entry?.job_id ?? "none");
  const [startTime, setStartTime] = useState(entry?.start_time ?? "");
  const [endTime, setEndTime] = useState(entry?.end_time ?? "");
  const [producedQty, setProducedQty] = useState(entry?.produced_qty ?? 0);
  const [scrapQty, setScrapQty] = useState(entry?.scrap_qty ?? 0);
  const [downtimeMinutes, setDowntimeMinutes] = useState(entry?.downtime_minutes ?? 0);
  const [notes, setNotes] = useState(entry?.notes ?? "");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!machineId) {
      toast.error("Lütfen makine seçin");
      return;
    }
    startTransition(async () => {
      const result = await saveProductionEntry({
        id: entry?.id,
        entry_date: entryDate,
        shift,
        machine_id: machineId,
        operator_id: operatorId === "none" ? null : operatorId,
        job_id: jobId === "none" ? null : jobId,
        start_time: startTime || null,
        end_time: endTime || null,
        produced_qty: producedQty,
        scrap_qty: scrapQty,
        downtime_minutes: downtimeMinutes,
        notes,
      });
      if (result.error) toast.error(result.error);
      else {
        toast.success(entry ? "Kayıt güncellendi" : "Üretim formu eklendi");
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {entry ? "Üretim Formu Düzenle" : "Yeni Üretim Formu"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ed">Tarih *</Label>
              <Input
                id="ed"
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sh">Vardiya *</Label>
              <Select value={shift} onValueChange={(v) => setShift(v as Shift)}>
                <SelectTrigger id="sh">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SHIFTS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {SHIFT_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="mc">Makine *</Label>
              <Select value={machineId} onValueChange={setMachineId}>
                <SelectTrigger id="mc">
                  <SelectValue placeholder="Seçin" />
                </SelectTrigger>
                <SelectContent>
                  {machines.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="op">Operatör</Label>
              <Select value={operatorId} onValueChange={setOperatorId}>
                <SelectTrigger id="op">
                  <SelectValue placeholder="Seçilmedi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {operators.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="jo">İş / Sipariş</Label>
            <Select value={jobId} onValueChange={setJobId}>
              <SelectTrigger id="jo">
                <SelectValue placeholder="Seçilmedi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {jobs.map((j) => (
                  <SelectItem key={j.id} value={j.id}>
                    {j.job_no ? `${j.job_no} · ` : ""}
                    {j.customer} - {j.part_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="stt">Başlangıç Saati</Label>
              <Input id="stt" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ett">Bitiş Saati</Label>
              <Input id="ett" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pq">Üretilen *</Label>
              <Input
                id="pq"
                type="number"
                min={0}
                value={producedQty}
                onChange={(e) => setProducedQty(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sq">Fire</Label>
              <Input
                id="sq"
                type="number"
                min={0}
                value={scrapQty}
                onChange={(e) => setScrapQty(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dm">Duruş (dk)</Label>
              <Input
                id="dm"
                type="number"
                min={0}
                value={downtimeMinutes}
                onChange={(e) => setDowntimeMinutes(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nt">Notlar</Label>
            <Textarea
              id="nt"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Problem, yorumlar..."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              İptal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {entry ? "Kaydet" : "Ekle"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
