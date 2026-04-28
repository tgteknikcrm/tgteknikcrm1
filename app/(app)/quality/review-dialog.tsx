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
import { Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { addQualityReview } from "./actions";
import {
  QC_REVIEWER_ROLE_LABEL,
  QC_REVIEW_STATUS_LABEL,
  type QcReviewerRole,
  type QcReviewStatus,
} from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

interface Props {
  jobId: string;
  trigger: React.ReactNode;
}

const ROLES: QcReviewerRole[] = ["operator", "kontrolor", "onaylayan"];
const STATUSES: QcReviewStatus[] = ["onaylandi", "koşullu", "reddedildi"];

export function ReviewDialog({ jobId, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [role, setRole] = useState<QcReviewerRole>("kontrolor");
  const [status, setStatus] = useState<QcReviewStatus>("onaylandi");
  const [notes, setNotes] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r = await addQualityReview({
        job_id: jobId,
        reviewer_role: role,
        status,
        notes,
      });
      if (r.error) toast.error(r.error);
      else {
        toast.success("Onay imzalandı");
        setOpen(false);
        setNotes("");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Kalite Onayı</DialogTitle>
          <DialogDescription>
            Bu işin kalite kontrolünü hangi rolde imzalıyorsun?
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="qr-role">Rol</Label>
            <Select value={role} onValueChange={(v) => setRole(v as QcReviewerRole)}>
              <SelectTrigger id="qr-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {QC_REVIEWER_ROLE_LABEL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Karar</Label>
            <div className="grid grid-cols-3 gap-2">
              {STATUSES.map((s) => {
                const Icon =
                  s === "onaylandi"
                    ? CheckCircle2
                    : s === "reddedildi"
                    ? XCircle
                    : AlertTriangle;
                const active = status === s;
                const tone =
                  s === "onaylandi"
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-700"
                    : s === "reddedildi"
                    ? "border-red-500 bg-red-500/10 text-red-700"
                    : "border-amber-500 bg-amber-500/10 text-amber-700";
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={cn(
                      "border rounded-lg p-2 flex flex-col items-center gap-1 text-xs font-medium transition",
                      active ? tone : "border-border hover:bg-muted/50",
                    )}
                  >
                    <Icon className="size-4" />
                    {QC_REVIEW_STATUS_LABEL[s]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qr-notes">Not (opsiyonel)</Label>
            <Textarea
              id="qr-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Şartlar, eksikler, müşteri talebi vs."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              İptal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              İmzala
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
