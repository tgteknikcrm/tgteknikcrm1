"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Camera,
  CheckCheck,
  Loader2,
  Sparkles,
  Droplets,
  Trash2,
  X,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  INSPECTION_TEMPLATES,
  INSPECTION_TYPE_LABEL,
  getCurrentShift,
  type InspectionItem,
  type InspectionType,
} from "@/lib/supabase/types";
import { saveInspection, uploadInspectionPhoto } from "./actions";

interface Props {
  machineId: string;
  type: InspectionType;
  trigger: React.ReactNode;
}

interface StagedPhoto {
  file: File;
  previewUrl: string;
  // After upload completes, we get back a storage path. Until then path
  // is null; on save, we filter for paths only.
  path: string | null;
  uploading: boolean;
  error: string | null;
}

export function InspectionDialog({ machineId, type, trigger }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<InspectionItem[]>(() =>
    INSPECTION_TEMPLATES[type].map((it) => ({ ...it })),
  );
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<StagedPhoto[]>([]);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state every time the dialog opens. Avoids stale checks
  // between successive inspections.
  useEffect(() => {
    if (!open) return;
    setItems(INSPECTION_TEMPLATES[type].map((it) => ({ ...it })));
    setNotes("");
    setPhotos([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [open, type]);

  // Cleanup object URLs on unmount / when photos array changes.
  useEffect(() => {
    return () => {
      for (const p of photos) URL.revokeObjectURL(p.previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const Icon = type === "temizlik" ? Sparkles : Droplets;
  const title = INSPECTION_TYPE_LABEL[type];
  const allOk = items.every((it) => it.ok || it.na);
  const okCount = items.filter((it) => it.ok).length;

  function setAllOk() {
    setItems((prev) => prev.map((it) => ({ ...it, ok: true, na: false })));
  }

  function toggleItem(key: string) {
    setItems((prev) =>
      prev.map((it) => (it.key === key ? { ...it, ok: !it.ok, na: false } : it)),
    );
  }

  function toggleNa(key: string) {
    setItems((prev) =>
      prev.map((it) =>
        it.key === key ? { ...it, na: !it.na, ok: false } : it,
      ),
    );
  }

  function pickFile() {
    fileInputRef.current?.click();
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    if (fileInputRef.current) fileInputRef.current.value = "";

    for (const file of list) {
      if (!file.type.startsWith("image/")) {
        toast.error(`'${file.name}': sadece görsel kabul edilir`);
        continue;
      }
      if (file.size > 12 * 1024 * 1024) {
        toast.error(`'${file.name}': 12 MB üstü reddedildi`);
        continue;
      }
      const previewUrl = URL.createObjectURL(file);
      const staged: StagedPhoto = {
        file,
        previewUrl,
        path: null,
        uploading: true,
        error: null,
      };
      setPhotos((prev) => [...prev, staged]);

      // Fire-and-forget upload. We mutate by reference via setPhotos.
      const fd = new FormData();
      fd.append("file", file);
      const r = await uploadInspectionPhoto(machineId, fd);
      setPhotos((prev) =>
        prev.map((p) =>
          p.previewUrl === previewUrl
            ? {
                ...p,
                uploading: false,
                path: r.path ?? null,
                error: r.error ?? null,
              }
            : p,
        ),
      );
      if (r.error) toast.error(r.error);
    }
  }

  function removePhoto(previewUrl: string) {
    setPhotos((prev) => {
      const target = prev.find((p) => p.previewUrl === previewUrl);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.previewUrl !== previewUrl);
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (photos.some((p) => p.uploading)) {
      toast.error("Resim yüklemeleri bitsin, sonra tekrar dene");
      return;
    }
    const photoPaths = photos
      .filter((p) => p.path)
      .map((p) => p.path!) as string[];
    startTransition(async () => {
      const r = await saveInspection({
        machineId,
        type,
        shift: getCurrentShift(),
        items,
        notes,
        photoPaths,
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(`${title} kaydı eklendi`);
      // Free preview URLs.
      for (const p of photos) URL.revokeObjectURL(p.previewUrl);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Icon className="size-5 text-primary" /> Yeni {title} Kaydı
          </DialogTitle>
          <DialogDescription className="text-sm">
            Maddeleri tek tek tıkla ya da hepsi tamamsa &quot;Hepsi OK&quot;
            butonunu kullan. İstersen 1-3 fotoğraf da ekleyebilirsin.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-5">
          {/* Quick "all OK" + counter */}
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant={allOk ? "default" : "outline"}
              onClick={setAllOk}
              className="h-10 gap-2"
            >
              <CheckCheck className="size-4" />
              Hepsi OK
            </Button>
            <Badge
              variant="outline"
              className={cn(
                "tabular-nums text-base px-3 py-1",
                allOk &&
                  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40",
              )}
            >
              {okCount} / {items.length}
            </Badge>
          </div>

          {/* Checklist */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">Kontrol Listesi</Label>
            <ul className="space-y-1.5">
              {items.map((it) => (
                <li
                  key={it.key}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border px-3 py-2.5 transition",
                    it.ok &&
                      "bg-emerald-500/10 border-emerald-500/40",
                    it.na && "bg-muted/50 border-dashed opacity-70",
                  )}
                >
                  <Checkbox
                    checked={it.ok}
                    onCheckedChange={() => toggleItem(it.key)}
                    className="size-5"
                  />
                  <span
                    className={cn(
                      "flex-1 text-base",
                      it.na && "line-through text-muted-foreground",
                    )}
                  >
                    {it.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleNa(it.key)}
                    className={cn(
                      "text-xs font-medium px-2 py-1 rounded transition",
                      it.na
                        ? "bg-muted text-muted-foreground"
                        : "text-muted-foreground hover:bg-muted/70",
                    )}
                    title="Bu makinede uygun değilse (N/A)"
                  >
                    {it.na ? "N/A" : "—"}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Photos */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">Fotoğraflar</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={onFileChange}
            />
            {photos.length === 0 ? (
              <button
                type="button"
                onClick={pickFile}
                className={cn(
                  "w-full rounded-lg border-2 border-dashed py-6 flex flex-col items-center gap-2",
                  "text-muted-foreground hover:border-primary/50 hover:text-foreground transition",
                )}
              >
                <Camera className="size-8" />
                <div className="text-base font-medium">
                  Kamera ile çek veya seç
                </div>
                <div className="text-xs">JPG / PNG / WebP · maks 12 MB</div>
              </button>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {photos.map((p) => (
                  <div
                    key={p.previewUrl}
                    className="relative aspect-square rounded-lg border overflow-hidden bg-muted/30"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.previewUrl}
                      alt=""
                      className="absolute inset-0 size-full object-cover"
                    />
                    {p.uploading && (
                      <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                        <Loader2 className="size-5 animate-spin" />
                      </div>
                    )}
                    {p.error && (
                      <div className="absolute inset-0 bg-red-500/70 text-white text-[10px] p-2 flex items-center justify-center text-center">
                        {p.error}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removePhoto(p.previewUrl)}
                      className="absolute top-1 right-1 size-6 rounded-full bg-background/80 hover:bg-red-500/90 hover:text-white flex items-center justify-center transition"
                      aria-label="Resmi kaldır"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={pickFile}
                  className={cn(
                    "aspect-square rounded-lg border-2 border-dashed",
                    "flex flex-col items-center justify-center gap-1 text-muted-foreground",
                    "hover:border-primary/50 hover:text-foreground transition",
                  )}
                >
                  <Upload className="size-5" />
                  <span className="text-xs">Daha</span>
                </button>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">Not (opsiyonel)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Dikkat çekici bir şey, eksik kalan kontrol vb."
              className="text-base"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              İptal
            </Button>
            <Button type="submit" disabled={pending} className="gap-1.5">
              {pending && <Loader2 className="size-4 animate-spin" />}
              <CheckCheck className="size-4" /> Kaydet
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Convenience: single delete button for inspection rows.
export function InspectionDeleteButton({
  inspectionId,
  machineId,
  label,
}: {
  inspectionId: string;
  machineId: string;
  label: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!confirm(`'${label}' kaydı silinsin mi?`)) return;
    startTransition(async () => {
      const { deleteInspection } = await import("./actions");
      const r = await deleteInspection(inspectionId, machineId);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Silindi");
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-red-500/15 hover:text-red-700 transition opacity-0 group-hover:opacity-100"
      title="Sil"
      aria-label="Sil"
    >
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Trash2 className="size-3.5" />
      )}
    </button>
  );
}
