"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteDrawing, getSignedUrl } from "./actions";

export function DownloadButton({ path, fileName }: { path: string; fileName: string }) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const r = await getSignedUrl(path);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      if (!r.url) return;
      const a = document.createElement("a");
      a.href = r.url;
      a.download = fileName;
      a.click();
    });
  }

  return (
    <Button variant="ghost" size="icon" onClick={onClick} disabled={pending} title="İndir (orijinal)">
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
    </Button>
  );
}

export function DeleteDrawingButton({
  id,
  path,
  title,
}: {
  id: string;
  path: string;
  title: string;
}) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!confirm(`'${title}' silinsin mi?`)) return;
    startTransition(async () => {
      const r = await deleteDrawing(id, path);
      if (r.error) toast.error(r.error);
      else toast.success("Silindi");
    });
  }

  return (
    <Button variant="ghost" size="icon" onClick={onClick} disabled={pending} title="Sil">
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
    </Button>
  );
}
