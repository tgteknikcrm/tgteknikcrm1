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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { saveOperator } from "./actions";
import { SHIFT_LABEL, type Operator, type Shift } from "@/lib/supabase/types";
import { Loader2 } from "lucide-react";

interface Props {
  operator?: Operator;
  trigger: React.ReactNode;
}

const SHIFTS: Shift[] = ["sabah", "aksam", "gece"];

export function OperatorDialog({ operator, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [fullName, setFullName] = useState(operator?.full_name ?? "");
  const [employeeNo, setEmployeeNo] = useState(operator?.employee_no ?? "");
  const [phone, setPhone] = useState(operator?.phone ?? "");
  const [shift, setShift] = useState<string>(operator?.shift ?? "none");
  const [active, setActive] = useState(operator?.active ?? true);
  const [notes, setNotes] = useState(operator?.notes ?? "");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await saveOperator({
        id: operator?.id,
        full_name: fullName,
        employee_no: employeeNo,
        phone,
        shift: shift === "none" ? null : (shift as Shift),
        active,
        notes,
      });
      if (result.error) toast.error(result.error);
      else {
        toast.success(operator ? "Operatör güncellendi" : "Operatör eklendi");
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
            {operator ? "Operatör Düzenle" : "Yeni Operatör"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="fn">Ad Soyad *</Label>
            <Input
              id="fn"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="eno">Sicil No</Label>
              <Input
                id="eno"
                value={employeeNo}
                onChange={(e) => setEmployeeNo(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ph">Telefon</Label>
              <Input
                id="ph"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sh">Vardiya</Label>
            <Select value={shift} onValueChange={setShift}>
              <SelectTrigger id="sh">
                <SelectValue placeholder="Seçilmedi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {SHIFTS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {SHIFT_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="ac"
              checked={active}
              onCheckedChange={(v) => setActive(Boolean(v))}
            />
            <Label htmlFor="ac">Aktif</Label>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="no">Notlar</Label>
            <Textarea
              id="no"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              İptal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {operator ? "Kaydet" : "Ekle"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
