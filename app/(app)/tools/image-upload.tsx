"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Camera, Trash2, Upload, ImageOff } from "lucide-react";
import { setToolImage, removeToolImage } from "./actions";
import { toolImagePublicUrl } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

interface Props {
  toolId: string;
  initialPath: string | null;
}

export function ToolImageUpload({ toolId, initialPath }: Props) {
  const [path, setPath] = useState<string | null>(initialPath);
  const [pending, startTransition] = useTransition();
  const [imgError, setImgError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const url = toolImagePublicUrl(path);

  function pickFile() {
    fileInputRef.current?.click();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // client-side guard
    if (!file.type.startsWith("image/")) {
      toast.error("Sadece görsel dosyası seçilebilir.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Dosya en fazla 8 MB olabilir.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    startTransition(async () => {
      const r = await setToolImage(toolId, formData);
      if (r.error) {
        toast.error(r.error);
      } else {
        toast.success("Resim yüklendi");
        setPath(r.path ?? null);
        setImgError(false);
      }
      // Reset input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
  }

  function onRemove() {
    if (!confirm("Resim silinsin mi?")) return;
    startTransition(async () => {
      const r = await removeToolImage(toolId);
      if (r.error) {
        toast.error(r.error);
      } else {
        toast.success("Resim kaldırıldı");
        setPath(null);
        setImgError(false);
      }
    });
  }

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFileChange}
      />

      {url && !imgError ? (
        <div className="relative group rounded-lg overflow-hidden border bg-muted/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="Takım"
            className="w-full max-h-56 object-contain"
            onError={() => setImgError(true)}
          />
          {pending && (
            <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
              <Loader2 className="size-6 animate-spin" />
            </div>
          )}
          <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={pickFile}
              disabled={pending}
              className="h-8 shadow"
            >
              <Upload className="size-3.5" /> Değiştir
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={onRemove}
              disabled={pending}
              className="h-8 shadow"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={pickFile}
          disabled={pending}
          className={cn(
            "w-full rounded-lg border-2 border-dashed p-6 flex flex-col items-center justify-center gap-2 text-muted-foreground transition",
            "hover:border-primary/50 hover:bg-muted/30 hover:text-foreground",
            pending && "opacity-60 cursor-wait",
          )}
        >
          {pending ? (
            <Loader2 className="size-7 animate-spin" />
          ) : imgError ? (
            <ImageOff className="size-7" />
          ) : (
            <Camera className="size-7" />
          )}
          <div className="text-center">
            <p className="text-sm font-medium">
              {imgError ? "Resim yüklenemedi" : "Resim ekle"}
            </p>
            <p className="text-xs text-muted-foreground">
              JPG / PNG / WebP · maks 8 MB
            </p>
          </div>
        </button>
      )}
    </div>
  );
}
