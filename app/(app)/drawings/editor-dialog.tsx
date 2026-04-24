"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { getSignedUrl } from "./actions";
import { AnnotationEditor } from "./annotation-editor";
import type { Drawing } from "@/lib/supabase/types";

interface Props {
  drawing: Drawing;
}

export function EditorDialog({ drawing }: Props) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
        title="Düzenle (üzerine yaz/çiz)"
      >
        <Pencil className="size-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-6xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Düzenle — {drawing.title}</DialogTitle>
          </DialogHeader>
          {loading || !url ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <AnnotationEditor
              imageUrl={url}
              drawingId={drawing.id}
              initialAnnotations={drawing.annotations}
              onSaved={() => {
                /* keep open so user can keep editing or close manually */
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
