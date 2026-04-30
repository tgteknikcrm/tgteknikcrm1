"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Download,
  FileImage,
  FileQuestion,
  FileText,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import {
  deleteDrawing,
  getSignedUrl,
  uploadDrawing,
} from "../../drawings/actions";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface DrawingItem {
  id: string;
  title: string;
  file_path: string;
  file_type: string | null;
  revision: string | null;
  created_at: string;
  annotations: unknown | null;
}

export function ProductDrawingsTab({
  productId,
  items,
}: {
  productId: string;
  items: DrawingItem[];
}) {
  const router = useRouter();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  function onUploaded() {
    setUploadOpen(false);
    router.refresh();
  }

  function downloadOne(path: string, filename: string) {
    startTransition(async () => {
      const r = await getSignedUrl(path);
      if ("error" in r && r.error) {
        toast.error(r.error);
        return;
      }
      const url = "url" in r ? r.url : null;
      if (!url) return;
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
  }

  function removeOne(id: string, path: string, title: string) {
    if (!confirm(`'${title}' silinsin mi?`)) return;
    setBusyId(id);
    startTransition(async () => {
      const r = await deleteDrawing(id, path);
      setBusyId(null);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Silindi");
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="text-xs text-muted-foreground">
            Bu ürüne bağlı PDF / görsel teknik resim ve çizimler.
          </div>
          <Button onClick={() => setUploadOpen(true)} size="sm" className="gap-1.5">
            <Plus className="size-3.5" /> Teknik Resim Yükle
          </Button>
        </div>

        {items.length === 0 ? (
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className={cn(
              "w-full rounded-lg border-2 border-dashed bg-card/40 hover:bg-card transition",
              "py-12 flex flex-col items-center justify-center gap-2 cursor-pointer",
            )}
          >
            <Upload className="size-7 text-muted-foreground" />
            <div className="text-sm font-medium">İlk teknik resmi yükle</div>
            <div className="text-xs text-muted-foreground">
              PDF, JPG, PNG, WebP, DWG/DXF
            </div>
          </button>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {items.map((d) => {
              const isPdf =
                d.file_type === "application/pdf" ||
                d.file_path.toLowerCase().endsWith(".pdf");
              const isImg =
                d.file_type?.startsWith("image/") ||
                /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(d.file_path);
              const Icon = isPdf ? FileText : isImg ? FileImage : FileQuestion;
              const fileName = (d.file_path.split("/").pop() ?? "").replace(
                /^\d+_/,
                "",
              );
              return (
                <li
                  key={d.id}
                  className="group flex items-center gap-3 px-3 py-2 rounded-lg border bg-card hover:bg-muted/30 transition"
                >
                  <div className="size-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate flex items-center gap-1.5">
                      {d.title}
                      {d.annotations != null && (
                        <Badge variant="outline" className="text-[9px]">
                          ✏️ Düzenli
                        </Badge>
                      )}
                      {d.revision && (
                        <Badge variant="outline" className="text-[9px]">
                          Rev. {d.revision}
                        </Badge>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {fileName} · {formatDate(d.created_at)}
                    </div>
                  </div>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => downloadOne(d.file_path, fileName)}
                      disabled={pending}
                      className="size-8"
                      title="İndir"
                    >
                      <Download className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeOne(d.id, d.file_path, d.title)}
                      disabled={busyId === d.id}
                      className="size-8 text-red-600 hover:text-red-600 hover:bg-red-500/10"
                      title="Sil"
                    >
                      {busyId === d.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="size-3.5" />
                      )}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      <DrawingUploadDialog
        productId={productId}
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUploaded={onUploaded}
      />
    </Card>
  );
}

function DrawingUploadDialog({
  productId,
  open,
  onOpenChange,
  onUploaded,
}: {
  productId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onUploaded: () => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [title, setTitle] = useState("");
  const [revision, setRevision] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();

  function reset() {
    setTitle("");
    setRevision("");
    setNotes("");
    if (fileRef.current) fileRef.current.value = "";
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("Dosya seçilmedi");
      return;
    }
    if (!title.trim()) {
      toast.error("Başlık zorunlu");
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    fd.append("title", title.trim());
    fd.append("product_id", productId);
    fd.append("revision", revision);
    fd.append("notes", notes);
    startTransition(async () => {
      const r = await uploadDrawing(fd);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Teknik resim yüklendi");
      reset();
      onUploaded();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Teknik Resim Yükle</DialogTitle>
          <DialogDescription>Bu ürüne bağlanır.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="d-file">Dosya *</Label>
            <Input
              id="d-file"
              ref={fileRef}
              type="file"
              accept="application/pdf,image/*,.dwg,.dxf"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="d-title">Başlık *</Label>
              <Input
                id="d-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Flanş - Üst Görünüm"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d-rev">Revizyon</Label>
              <Input
                id="d-rev"
                value={revision}
                onChange={(e) => setRevision(e.target.value)}
                placeholder="A"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="d-notes">Notlar</Label>
            <Input
              id="d-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opsiyonel"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
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
