"use client";

import { useEffect, useRef, useState } from "react";
import * as fabric from "fabric";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Eye, Loader2, FileDown, MessageCircle, Image as ImageIcon, FileText } from "lucide-react";
import { toast } from "sonner";
import { getSignedUrl } from "./actions";
import {
  canvasToPng,
  dataUrlToBlob,
  downloadCanvasAsPdf,
  downloadImageUrlAsPdf,
  downloadUrl,
  tryShareFile,
  whatsappLinkForUrl,
} from "@/lib/drawings-export";
import { isImageDrawing, isPdfDrawing, type Drawing } from "@/lib/supabase/types";

interface Props {
  drawing: Drawing;
}

export function ViewerDialog({ drawing }: Props) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isPdf = isPdfDrawing(drawing);
  const isImage = isImageDrawing(drawing);

  useEffect(() => {
    if (!open) {
      setUrl(null);
      return;
    }
    setLoading(true);
    getSignedUrl(drawing.file_path).then((r) => {
      if (r.error) {
        toast.error(r.error);
        setOpen(false);
      } else if (r.url) {
        setUrl(r.url);
      }
      setLoading(false);
    });
  }, [open, drawing.file_path]);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        title="Göster"
      >
        <Eye className="size-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-5xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{drawing.title}</DialogTitle>
            <DialogDescription>
              {isPdf
                ? "PDF görünümü — düzenleme yapılmaz, dokümanı olduğu gibi gösterir."
                : isImage
                ? "Resim görünümü — açıklamalar (varsa) üstüne uygulanır."
                : "Bu dosya türü için yalnızca indirme/dış görüntüleme mevcut."}
            </DialogDescription>
          </DialogHeader>

          {loading || !url ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : isPdf ? (
            <PdfViewer url={url} drawing={drawing} />
          ) : isImage ? (
            <ImageViewer
              url={url}
              drawing={drawing}
              onClose={() => setOpen(false)}
            />
          ) : (
            <div className="text-center text-sm text-muted-foreground py-10 space-y-3">
              <p>Bu dosya türü tarayıcıda gösterilemiyor.</p>
              <Button onClick={() => downloadUrl(url, drawing.title)}>
                Dosyayı İndir
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// -------------------------------------------------------------------------
// PDF: native render via <iframe>, plus download / WhatsApp share buttons
// -------------------------------------------------------------------------
function PdfViewer({ url, drawing }: { url: string; drawing: Drawing }) {
  const fileName = drawing.title.endsWith(".pdf")
    ? drawing.title
    : `${drawing.title}.pdf`;

  async function shareWhatsapp() {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const ok = await tryShareFile(blob, fileName, drawing.title);
      if (!ok) {
        // Fallback: open wa.me with the signed URL
        window.open(whatsappLinkForUrl(url, drawing.title), "_blank");
      }
    } catch {
      window.open(whatsappLinkForUrl(url, drawing.title), "_blank");
    }
  }

  return (
    <>
      <div className="rounded-lg border overflow-hidden bg-muted/20">
        <iframe
          src={url}
          title={drawing.title}
          className="w-full h-[70vh] border-0"
        />
      </div>
      <DialogFooter className="flex flex-row gap-2 justify-end flex-wrap">
        <Button variant="outline" onClick={() => downloadUrl(url, fileName)} className="gap-1.5">
          <FileDown className="size-4" /> PDF İndir
        </Button>
        <Button onClick={shareWhatsapp} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
          <MessageCircle className="size-4" /> WhatsApp ile Gönder
        </Button>
      </DialogFooter>
    </>
  );
}

// -------------------------------------------------------------------------
// Image: render image + saved annotations on a Fabric canvas (read-only).
// Buttons: download as PNG, download as PDF, WhatsApp share, open in new tab.
// -------------------------------------------------------------------------
function ImageViewer({
  url,
  drawing,
  onClose,
}: {
  url: string;
  drawing: Drawing;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      selection: false,
      backgroundColor: "#f8fafc",
    });
    fabricRef.current = canvas;
    let cancelled = false;

    (async () => {
      try {
        const img = await fabric.FabricImage.fromURL(url, {
          crossOrigin: "anonymous",
        });
        if (cancelled) return;

        const containerW = containerRef.current!.clientWidth;
        const maxW = Math.min(containerW - 4, 1400);
        const maxH = Math.min(window.innerHeight - 280, 800);
        const scale = Math.min(
          maxW / (img.width ?? 1),
          maxH / (img.height ?? 1),
          1,
        );
        const w = (img.width ?? 800) * scale;
        const h = (img.height ?? 600) * scale;

        canvas.setDimensions({ width: w, height: h });
        img.scale(scale);
        img.set({ selectable: false, evented: false });
        canvas.backgroundImage = img;

        if (drawing.annotations) {
          await canvas.loadFromJSON(drawing.annotations as object);
          canvas.backgroundImage = img;
          // Lock all objects in viewer mode
          canvas.getObjects().forEach((o) => {
            o.set({ selectable: false, evented: false });
          });
        }
        canvas.renderAll();
        setReady(true);
      } catch (e) {
        console.error(e);
        toast.error("Görsel yüklenemedi");
      }
    })();

    return () => {
      cancelled = true;
      canvas.dispose();
      fabricRef.current = null;
    };
  }, [url, drawing.annotations]);

  const baseName = drawing.title.replace(/\.[^.]+$/, "") || "resim";

  async function downloadPng() {
    const c = fabricRef.current;
    if (!c) return;
    const { dataUrl } = await canvasToPng(c);
    downloadUrl(dataUrl, `${baseName}.png`);
  }

  async function downloadPdf() {
    const c = fabricRef.current;
    if (!c) return;
    setBusy(true);
    try {
      await downloadCanvasAsPdf(c, baseName);
    } finally {
      setBusy(false);
    }
  }

  async function downloadOriginalAsPdf() {
    setBusy(true);
    try {
      await downloadImageUrlAsPdf(url, `${baseName}-orijinal`);
    } finally {
      setBusy(false);
    }
  }

  async function shareWhatsapp() {
    const c = fabricRef.current;
    if (!c) return;
    const { dataUrl } = await canvasToPng(c);
    const blob = dataUrlToBlob(dataUrl);
    const ok = await tryShareFile(
      blob,
      `${baseName}.png`,
      drawing.title,
    );
    if (!ok) {
      // Fallback: download + open WhatsApp Web with prompt
      downloadUrl(dataUrl, `${baseName}.png`);
      toast.message("Resim indirildi", {
        description: "WhatsApp Web açılıyor — sohbete yapıştır veya ek olarak yükle.",
      });
      window.open("https://web.whatsapp.com/", "_blank");
    }
    void onClose;
  }

  return (
    <>
      <div
        ref={containerRef}
        className="rounded-lg border bg-muted/30 overflow-auto p-2 flex justify-center"
      >
        <canvas ref={canvasRef} />
      </div>
      <DialogFooter className="flex flex-row gap-2 justify-end flex-wrap">
        <Button
          variant="outline"
          onClick={downloadPng}
          disabled={!ready || busy}
          className="gap-1.5"
        >
          <ImageIcon className="size-4" /> PNG İndir
        </Button>
        <Button
          variant="outline"
          onClick={downloadOriginalAsPdf}
          disabled={!ready || busy}
          className="gap-1.5"
        >
          <FileText className="size-4" /> Orijinal PDF
        </Button>
        <Button onClick={downloadPdf} disabled={!ready || busy} className="gap-1.5">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
          PDF İndir
        </Button>
        <Button
          onClick={shareWhatsapp}
          disabled={!ready || busy}
          className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
        >
          <MessageCircle className="size-4" /> WhatsApp
        </Button>
      </DialogFooter>
    </>
  );
}
