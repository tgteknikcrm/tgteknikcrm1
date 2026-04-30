"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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
import type { Job, Product } from "@/lib/supabase/types";
import { Boxes, Loader2, Upload } from "lucide-react";

interface Props {
  jobs: Job[];
  products?: Product[];
  /** When set, dialog opens automatically with this file pre-selected. */
  prefillFile?: File | null;
  externalOpen?: boolean;
  onExternalOpenChange?: (v: boolean) => void;
}

export function UploadDialog({
  jobs,
  products = [],
  prefillFile = null,
  externalOpen,
  onExternalOpenChange,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen ?? internalOpen;
  const setOpen = (v: boolean) => {
    if (externalOpen !== undefined) onExternalOpenChange?.(v);
    else setInternalOpen(v);
  };
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement | null>(null);

  // When the page-level drop hands us a file, mirror it into the file
  // input so the form submission picks it up automatically.
  useEffect(() => {
    if (!prefillFile || !fileRef.current) return;
    const dt = new DataTransfer();
    dt.items.add(prefillFile);
    fileRef.current.files = dt.files;
  }, [prefillFile]);

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
              ref={fileRef}
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
          {products.length > 0 && (
            <div className="space-y-1.5 rounded-lg border bg-primary/5 p-3">
              <Label
                htmlFor="product_id"
                className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-primary"
              >
                <Boxes className="size-3.5" /> Ürün (kütüphane)
              </Label>
              <Select name="product_id">
                <SelectTrigger id="product_id" className="bg-background">
                  <SelectValue placeholder="— Ürüne bağlama (opsiyonel) —" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="font-mono mr-1.5">{p.code}</span>· {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Ürüne bağlanan teknik resim, o ürünün her işinde otomatik
                kullanılabilir.
              </p>
            </div>
          )}

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
