"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getCadSignedUrl } from "./actions";

export function DownloadButton({ path }: { path: string }) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const r = await getCadSignedUrl(path);
      if (r.error || !r.url) {
        toast.error(r.error || "URL alınamadı");
        return;
      }
      window.open(r.url, "_blank", "noopener");
    });
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={pending}
      title="İndir"
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Download className="size-4" />
      )}
      İndir
    </Button>
  );
}
