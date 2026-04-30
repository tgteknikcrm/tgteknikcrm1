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
import { materializeProductIntoJob } from "@/app/(app)/products/actions";
import {
  JOB_STATUS_LABEL,
  type Job,
  type JobStatus,
  type Machine,
  type Operator,
  type Product,
} from "@/lib/supabase/types";
import { Boxes, Loader2 } from "lucide-react";

interface Props {
  job?: Job;
  machines: Machine[];
  operators: Operator[];
  products?: Product[];
  trigger: React.ReactNode;
}

const STATUSES: JobStatus[] = [
  "beklemede",
  "ayar",
  "uretimde",
  "tamamlandi",
  "iptal",
];

export function JobDialog({
  job,
  machines,
  operators,
  products = [],
  trigger,
}: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [productId, setProductId] = useState<string>(
    (job as Job & { product_id?: string | null })?.product_id ?? "none",
  );
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

  // Track the original product to know whether to (re)materialize tools.
  const originalProductId =
    (job as Job & { product_id?: string | null })?.product_id ?? null;

  function onProductSelect(value: string) {
    setProductId(value);
    if (value === "none") return;
    const p = products.find((x) => x.id === value);
    if (!p) return;
    // Auto-fill empty fields from the product. Don't overwrite user edits.
    if (!partName.trim()) setPartName(p.name);
    if (!partNo.trim() && p.code) setPartNo(p.code);
    if (!customer.trim() && p.customer) setCustomer(p.customer);
    if (quantity === 1 && p.default_quantity) setQuantity(p.default_quantity);
  }

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
        product_id: productId === "none" ? null : productId,
        status,
        priority,
        start_date: startDate || null,
        due_date: dueDate || null,
        notes,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      // If a product was newly attached, copy its default tool list
      // into the job's tools. Only fire when the product changed (or
      // when it's a brand-new job + product picked).
      const newJobId = "id" in result ? result.id : null;
      const productChanged =
        productId !== "none" && productId !== originalProductId;
      if (newJobId && productChanged) {
        const r = await materializeProductIntoJob(newJobId, productId);
        if (!("error" in r) || !r.error) {
          const count =
            "count" in r && typeof r.count === "number" ? r.count : 0;
          if (count > 0) {
            toast.success(`${count} takım otomatik olarak işe eklendi`);
          }
        }
      }
      toast.success(job ? "İş güncellendi" : "İş eklendi");
      setOpen(false);
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
          {products.length > 0 && (
            <div className="rounded-lg border bg-primary/5 p-3 space-y-1.5">
              <Label
                htmlFor="prod"
                className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-primary"
              >
                <Boxes className="size-3.5" /> Ürün Kütüphanesinden Seç
              </Label>
              <Select value={productId} onValueChange={onProductSelect}>
                <SelectTrigger id="prod" className="bg-background">
                  <SelectValue placeholder="— Yeni iş için ürün seç (opsiyonel) —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Ürün seçme —</SelectItem>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="font-mono mr-1.5">{p.code}</span>·{" "}
                      {p.name}
                      {p.customer && (
                        <span className="text-muted-foreground ml-1.5">
                          · {p.customer}
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Ürün seçince parça adı, kodu, adet otomatik dolar; kayıttan
                sonra varsayılan takımlar işe kopyalanır.
              </p>
            </div>
          )}

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
