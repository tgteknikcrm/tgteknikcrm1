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
import { Loader2, Upload } from "lucide-react";
import { uploadCadProgram } from "./actions";
import type { Job, Machine, Product } from "@/lib/supabase/types";
import { CAD_ACCEPT_EXTENSIONS } from "@/lib/supabase/types";
import { Boxes } from "lucide-react";

interface Props {
  machines: Pick<Machine, "id" | "name">[];
  jobs: Pick<Job, "id" | "job_no" | "customer" | "part_name">[];
  products?: Product[];
}

export function CadUploadDialog({ machines, jobs, products = [] }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    // Convert "none" sentinel back to empty (the action expects empty string)
    if (formData.get("machine_id") === "none") formData.set("machine_id", "");
    if (formData.get("job_id") === "none") formData.set("job_id", "");
    if (formData.get("product_id") === "none") formData.set("product_id", "");
    startTransition(async () => {
      const r = await uploadCadProgram(formData);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Program yüklendi");
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Upload className="size-4" /> Program Yükle
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>CAD/CAM Program Yükle</DialogTitle>
          <DialogDescription>
            G-code, NC, PDF, STEP, STL, DXF... maks 50 MB.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cad-file">Dosya *</Label>
            <Input
              id="cad-file"
              name="file"
              type="file"
              accept={CAD_ACCEPT_EXTENSIONS}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cad-title">Başlık *</Label>
            <Input
              id="cad-title"
              name="title"
              required
              placeholder="Mil-50 finiş program v2"
            />
          </div>
          {products.length > 0 && (
            <div className="space-y-1.5 rounded-lg border bg-primary/5 p-3">
              <Label
                htmlFor="cad-product"
                className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-primary"
              >
                <Boxes className="size-3.5" /> Ürün (kütüphane)
              </Label>
              <Select name="product_id" defaultValue="none">
                <SelectTrigger id="cad-product" className="bg-background">
                  <SelectValue placeholder="— Ürüne bağlama (opsiyonel) —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Ürün yok —</SelectItem>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="font-mono mr-1.5">{p.code}</span>· {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Ürüne bağlanan program o ürünün her işinde otomatik kullanılabilir.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cad-machine">Makine</Label>
              <Select name="machine_id" defaultValue="none">
                <SelectTrigger id="cad-machine">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— (yok)</SelectItem>
                  {machines.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cad-job">İş</Label>
              <Select name="job_id" defaultValue="none">
                <SelectTrigger id="cad-job">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— (yok)</SelectItem>
                  {jobs.map((j) => (
                    <SelectItem key={j.id} value={j.id}>
                      {j.job_no ? `${j.job_no} · ` : ""}
                      {j.customer} — {j.part_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cad-rev">Revizyon</Label>
              <Input id="cad-rev" name="revision" placeholder="ör. v2, Rev.B" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cad-notes">Notlar</Label>
            <Textarea id="cad-notes" name="notes" rows={2} />
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
