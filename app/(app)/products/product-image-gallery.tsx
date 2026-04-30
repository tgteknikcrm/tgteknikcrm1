"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Star, Trash2, Upload, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import {
  productImagePublicUrl,
  type ProductImage,
} from "@/lib/supabase/types";
import {
  deleteProductImage,
  setPrimaryProductImage,
  uploadProductImage,
} from "./actions";
import { cn } from "@/lib/utils";

/**
 * Product photo gallery — drag-drop or click-to-upload, multi-image,
 * one primary (used as the list thumbnail), with per-image
 * "Yıldızla" / "Sil" actions.
 *
 * Layout: 3-col responsive grid + a final "+" tile that triggers the
 * file picker. Drop-anywhere overlay highlights when the user drags
 * a file onto the panel.
 */
export function ProductImageGallery({
  productId,
  images,
}: {
  productId: string;
  images: ProductImage[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [pending, startTransition] = useTransition();
  const [dragOver, setDragOver] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const sorted = [...images].sort((a, b) => {
    if (a.is_primary && !b.is_primary) return -1;
    if (!a.is_primary && b.is_primary) return 1;
    return a.sort_order - b.sort_order;
  });

  function uploadOne(file: File) {
    return new Promise<void>((resolve) => {
      const fd = new FormData();
      fd.append("file", file);
      startTransition(async () => {
        const r = await uploadProductImage(productId, fd);
        if ("error" in r && r.error) toast.error(r.error);
        resolve();
      });
    });
  }

  async function uploadFiles(list: FileList | File[]) {
    const files = Array.from(list).filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) {
      toast.error("Sadece görsel dosyalar yüklenebilir.");
      return;
    }
    for (const f of files) {
      await uploadOne(f);
    }
    router.refresh();
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    void uploadFiles(files);
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      void uploadFiles(e.dataTransfer.files);
    }
  }

  function setPrimary(id: string) {
    setBusyId(id);
    startTransition(async () => {
      const r = await setPrimaryProductImage(id);
      setBusyId(null);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Kapak görsel olarak ayarlandı");
        router.refresh();
      }
    });
  }

  function remove(id: string) {
    if (!confirm("Bu görsel silinsin mi?")) return;
    setBusyId(id);
    startTransition(async () => {
      const r = await deleteProductImage(id);
      setBusyId(null);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Görsel silindi");
        router.refresh();
      }
    });
  }

  return (
    <div
      className={cn(
        "rounded-xl border bg-muted/20 p-3 transition",
        dragOver && "ring-2 ring-primary/40 bg-primary/5",
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={onPick}
      />

      {sorted.length === 0 ? (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={pending}
          className={cn(
            "w-full rounded-lg border-2 border-dashed bg-card/40 hover:bg-card transition",
            "py-12 flex flex-col items-center justify-center gap-2 cursor-pointer",
            pending && "opacity-60 cursor-not-allowed",
          )}
        >
          {pending ? (
            <Loader2 className="size-7 animate-spin text-muted-foreground" />
          ) : (
            <ImagePlus className="size-7 text-muted-foreground" />
          )}
          <div className="text-sm font-medium">Görsel ekle</div>
          <div className="text-xs text-muted-foreground">
            Tıkla ya da sürükle bırak · JPG/PNG/WebP · Maks 8 MB
          </div>
        </button>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {sorted.map((img) => {
            const url = productImagePublicUrl(img.image_path);
            return (
              <div
                key={img.id}
                className={cn(
                  "group relative rounded-lg overflow-hidden border bg-card aspect-square",
                  img.is_primary && "ring-2 ring-primary",
                )}
              >
                {url ? (
                  <Image
                    src={url}
                    alt={img.caption ?? ""}
                    width={300}
                    height={300}
                    className="size-full object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="size-full bg-muted" />
                )}
                {img.is_primary && (
                  <div className="absolute top-1 left-1 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-1.5 h-5 rounded flex items-center gap-1">
                    <Star className="size-3 fill-current" />
                    Kapak
                  </div>
                )}
                <div
                  className={cn(
                    "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent",
                    "flex items-center justify-end gap-1 px-1.5 py-1.5",
                    "opacity-0 group-hover:opacity-100 transition",
                  )}
                >
                  {!img.is_primary && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setPrimary(img.id)}
                      disabled={busyId === img.id}
                      className="size-7 bg-background/80 hover:bg-background"
                      title="Kapak yap"
                    >
                      {busyId === img.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Star className="size-3.5" />
                      )}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(img.id)}
                    disabled={busyId === img.id}
                    className="size-7 bg-background/80 hover:bg-red-500/20 text-red-500 hover:text-red-500"
                    title="Sil"
                  >
                    {busyId === img.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={pending}
            className={cn(
              "rounded-lg border-2 border-dashed bg-card/40 hover:bg-card transition",
              "aspect-square flex flex-col items-center justify-center gap-1 cursor-pointer",
              pending && "opacity-60 cursor-not-allowed",
            )}
          >
            {pending ? (
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            ) : (
              <Upload className="size-5 text-muted-foreground" />
            )}
            <div className="text-[11px] text-muted-foreground">Ekle</div>
          </button>
        </div>
      )}
    </div>
  );
}
