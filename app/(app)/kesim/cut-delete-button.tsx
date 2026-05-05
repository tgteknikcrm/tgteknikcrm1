"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteCutPiece } from "./actions";

export function CutDeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!confirm("Bu kesim kaydı silinsin mi?")) return;
    startTransition(async () => {
      const r = await deleteCutPiece(id);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Kesim silindi");
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="size-7 rounded-md bg-background/80 hover:bg-red-500/15 hover:text-red-700 text-muted-foreground border border-transparent hover:border-red-500/40 flex items-center justify-center transition"
      aria-label="Sil"
      title="Sil"
    >
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Trash2 className="size-3.5" />
      )}
    </button>
  );
}
