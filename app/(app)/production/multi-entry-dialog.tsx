"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { bulkSaveProductionEntries } from "./actions";
import {
  SHIFT_LABEL,
  type Job,
  type Machine,
  type Operator,
  type Shift,
} from "@/lib/supabase/types";

interface Props {
  machines: Machine[];
  operators: Operator[];
  jobs: Job[];
  trigger: React.ReactNode;
}

const SHIFTS: Shift[] = ["sabah", "aksam", "gece"];

interface Row {
  _key: string;
  jobId: string;
  startTime: string;
  endTime: string;
  produced: number;
  scrap: number;
  downtime: number;
  notes: string;
}

function newRow(): Row {
  return {
    _key: Math.random().toString(36).slice(2),
    jobId: "none",
    startTime: "",
    endTime: "",
    produced: 0,
    scrap: 0,
    downtime: 0,
    notes: "",
  };
}

/**
 * Single-shift, multi-job production form.
 *
 * Common across the form: date, shift, machine, operator. Below that
 * the user adds N rows — each row is one job's contribution to that
 * shift (qty + scrap + downtime + notes). Save → bulkSaveProductionEntries
 * inserts everything atomically.
 *
 * Mirrors how a typical operator records the day on paper: header
 * once, then a list of jobs they touched.
 */
export function MultiEntryDialog({ machines, operators, jobs, trigger }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const today = new Date().toISOString().slice(0, 10);
  const [entryDate, setEntryDate] = useState(today);
  const [shift, setShift] = useState<Shift>("sabah");
  const [machineId, setMachineId] = useState(machines[0]?.id ?? "");
  const [operatorId, setOperatorId] = useState<string>("none");
  const [rows, setRows] = useState<Row[]>([newRow()]);

  function addRow() {
    setRows((p) => [...p, newRow()]);
  }
  function removeRow(key: string) {
    setRows((p) => (p.length === 1 ? p : p.filter((r) => r._key !== key)));
  }
  function updateRow(key: string, patch: Partial<Row>) {
    setRows((p) => p.map((r) => (r._key === key ? { ...r, ...patch } : r)));
  }

  function reset() {
    setEntryDate(today);
    setShift("sabah");
    setMachineId(machines[0]?.id ?? "");
    setOperatorId("none");
    setRows([newRow()]);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!machineId) {
      toast.error("Makine seç");
      return;
    }
    if (rows.length === 0) {
      toast.error("En az bir giriş ekle");
      return;
    }
    // Filter empty rows (no produced, no scrap, no downtime, no notes, no job)
    const meaningful = rows.filter(
      (r) =>
        r.jobId !== "none" ||
        r.produced > 0 ||
        r.scrap > 0 ||
        r.downtime > 0 ||
        r.notes.trim() !== "",
    );
    if (meaningful.length === 0) {
      toast.error("Boş giriş — en az birine veri yaz");
      return;
    }
    startTransition(async () => {
      const r = await bulkSaveProductionEntries({
        entry_date: entryDate,
        shift,
        machine_id: machineId,
        operator_id: operatorId === "none" ? null : operatorId,
        rows: meaningful.map((row) => ({
          job_id: row.jobId === "none" ? null : row.jobId,
          start_time: row.startTime || null,
          end_time: row.endTime || null,
          produced_qty: row.produced,
          scrap_qty: row.scrap,
          downtime_minutes: row.downtime,
          notes: row.notes || null,
        })),
      });
      if ("error" in r && r.error) {
        toast.error(r.error);
        return;
      }
      const count = "count" in r && typeof r.count === "number" ? r.count : 0;
      toast.success(`${count} giriş kaydedildi`);
      setOpen(false);
      reset();
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Çoklu Üretim Girişi</DialogTitle>
          <DialogDescription>
            Aynı vardiyada bir makine birden fazla iş üzerinde çalışmışsa hepsini
            tek formda gir. Her satır bir işin o vardiyadaki katkısıdır.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          {/* Header — once per form */}
          <div className="rounded-lg border bg-muted/20 p-3 grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="m-date" className="text-[11px] font-bold uppercase">
                Tarih *
              </Label>
              <Input
                id="m-date"
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-shift" className="text-[11px] font-bold uppercase">
                Vardiya *
              </Label>
              <Select value={shift} onValueChange={(v) => setShift(v as Shift)}>
                <SelectTrigger id="m-shift">
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
            <div className="space-y-1.5">
              <Label htmlFor="m-machine" className="text-[11px] font-bold uppercase">
                Makine *
              </Label>
              <Select value={machineId} onValueChange={setMachineId}>
                <SelectTrigger id="m-machine">
                  <SelectValue placeholder="—" />
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
              <Label htmlFor="m-op" className="text-[11px] font-bold uppercase">
                Operatör
              </Label>
              <Select value={operatorId} onValueChange={setOperatorId}>
                <SelectTrigger id="m-op">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Yok —</SelectItem>
                  {operators.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Rows */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Üretim Kayıtları ({rows.length})
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addRow}
                className="h-7 px-2.5 text-xs gap-1"
              >
                <Plus className="size-3.5" /> Satır Ekle
              </Button>
            </div>

            {rows.map((r) => (
              <div
                key={r._key}
                className="rounded-lg border bg-card p-3 space-y-2"
              >
                <div className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-12 sm:col-span-5 space-y-1">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">
                      İş
                    </Label>
                    <Select
                      value={r.jobId}
                      onValueChange={(v) => updateRow(r._key, { jobId: v })}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Yok —</SelectItem>
                        {jobs.map((j) => (
                          <SelectItem key={j.id} value={j.id}>
                            {j.job_no ? `${j.job_no} · ` : ""}
                            {j.customer} - {j.part_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-6 sm:col-span-2 space-y-1">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">
                      Başlama
                    </Label>
                    <Input
                      type="time"
                      value={r.startTime}
                      onChange={(e) =>
                        updateRow(r._key, { startTime: e.target.value })
                      }
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-2 space-y-1">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">
                      Bitiş
                    </Label>
                    <Input
                      type="time"
                      value={r.endTime}
                      onChange={(e) =>
                        updateRow(r._key, { endTime: e.target.value })
                      }
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="col-span-12 sm:col-span-2 space-y-1">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">
                      Üretilen
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      value={r.produced}
                      onChange={(e) =>
                        updateRow(r._key, {
                          produced: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      className="h-8 text-sm tabular-nums"
                    />
                  </div>
                  <div className="col-span-12 sm:col-span-1 flex justify-end">
                    {rows.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRow(r._key)}
                        className="size-8 text-red-600 hover:text-red-600"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-6 sm:col-span-2 space-y-1">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">
                      Fire
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      value={r.scrap}
                      onChange={(e) =>
                        updateRow(r._key, {
                          scrap: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      className="h-8 text-sm tabular-nums"
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-2 space-y-1">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">
                      Duruş (dk)
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      value={r.downtime}
                      onChange={(e) =>
                        updateRow(r._key, {
                          downtime: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      className="h-8 text-sm tabular-nums"
                    />
                  </div>
                  <div className="col-span-12 sm:col-span-8 space-y-1">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">
                      Notlar
                    </Label>
                    <Input
                      value={r.notes}
                      onChange={(e) =>
                        updateRow(r._key, { notes: e.target.value })
                      }
                      placeholder="Takım değişimi, ayar, gözlem…"
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              İptal
            </Button>
            <Button type="submit" disabled={pending || !machineId}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {rows.length} Girişi Kaydet
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
