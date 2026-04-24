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
import { saveJob } from "./actions";
import {
  JOB_STATUS_LABEL,
  type Job,
  type JobStatus,
  type Machine,
  type Operator,
} from "@/lib/supabase/types";
import { Loader2 } from "lucide-react";

interface Props {
  job?: Job;
  machines: Machine[];
  operators: Operator[];
  trigger: React.ReactNode;
}

const STATUSES: JobStatus[] = ["beklemede", "uretimde", "tamamlandi", "iptal"];

export function JobDialog({ job, machines, operators, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [jobNo, setJobNo] = useState(job?.job_no ?? "");
  const [customer, setCustomer] = useState(job?.customer ?? "");
  const [partName, setPartName] = useState(job?.part_name ?? "");
  const [partNo, setPartNo] = useState(job?.part_no ?? "");
  const [quantity, setQuantity] = useState(job?.quantity ?? 1);
  const [machineId, setMachineId] = useState(job?.machine_id ?? "none");
  const [operatorId, setOperatorId] = useState(job?.operator_id ?? "none");
  const [status, setStatus] = useState<JobStatus>(job?.status ?? "beklemede");
  const [priority, setPriority] = useState(job?.priority ?? 3);
  const [startDate, setStartDate] = useState(job?.start_date ?? "");
  const [dueDate, setDueDate] = useState(job?.due_date ?? "");
  const [notes, setNotes] = useState(job?.notes ?? "");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await saveJob({
        id: job?.id,
        job_no: jobNo,
        customer,
        part_name: partName,
        part_no: partNo,
        quantity,
        machine_id: machineId === "none" ? null : machineId,
        operator_id: operatorId === "none" ? null : operatorId,
        status,
        priority,
        start_date: startDate || null,
        due_date: dueDate || null,
        notes,
      });
      if (result.error) toast.error(result.error);
      else {
        toast.success(job ? "İş güncellendi" : "İş eklendi");
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{job ? "İş Düzenle" : "Yeni İş / Sipariş"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="jn">İş No</Label>
              <Input id="jn" value={jobNo} onChange={(e) => setJobNo(e.target.value)} placeholder="ör. 2026-0001" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cu">Müşteri *</Label>
              <Input id="cu" value={customer} onChange={(e) => setCustomer(e.target.value)} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pn">Parça Adı *</Label>
              <Input id="pn" value={partName} onChange={(e) => setPartName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pno">Parça No</Label>
              <Input id="pno" value={partNo} onChange={(e) => setPartNo(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="qty">Adet *</Label>
              <Input
                id="qty"
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pr">Öncelik (1-5)</Label>
              <Input
                id="pr"
                type="number"
                min={1}
                max={5}
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="st">Durum</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as JobStatus)}>
                <SelectTrigger id="st">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {JOB_STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="mc">Makine</Label>
              <Select value={machineId} onValueChange={setMachineId}>
                <SelectTrigger id="mc">
                  <SelectValue placeholder="Seçilmedi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sd">Başlangıç</Label>
              <Input id="sd" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dd">Teslim Tarihi</Label>
              <Input id="dd" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nt">Notlar</Label>
            <Textarea id="nt" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              İptal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {job ? "Kaydet" : "Ekle"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
