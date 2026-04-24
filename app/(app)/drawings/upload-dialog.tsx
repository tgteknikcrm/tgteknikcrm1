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
import { uploadDrawing } from "./actions";
import type { Job } from "@/lib/supabase/types";
import { Loader2, Upload } from "lucide-react";

export function UploadDialog({ jobs }: { jobs: Job[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await uploadDrawing(formData);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Teknik resim yüklendi");
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Upload className="size-4" /> Yükle
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Teknik Resim Yükle</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="file">Dosya (PDF / Görsel) *</Label>
            <Input
              id="file"
              name="file"
              type="file"
              accept="image/*,application/pdf,.dwg,.dxf"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="title">Başlık *</Label>
            <Input id="title" name="title" required placeholder="ör. Flanş parça-A Rev.2" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="job_id">İş / Sipariş</Label>
              <Select name="job_id">
                <SelectTrigger id="job_id">
                  <SelectValue placeholder="Seçilmedi" />
                </SelectTrigger>
                <SelectContent>
                  {jobs.map((j) => (
                    <SelectItem key={j.id} value={j.id}>
                      {j.job_no ? `${j.job_no} · ` : ""}{j.customer} - {j.part_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="revision">Revizyon</Label>
              <Input id="revision" name="revision" placeholder="ör. Rev.2" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notlar</Label>
            <Textarea id="notes" name="notes" rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              İptal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Yükle
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
