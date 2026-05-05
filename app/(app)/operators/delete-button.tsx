"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

// Generic success shape: action may return { success: true } plus extra
// fields that the caller wants surfaced in the toast (e.g. cascade summary).
type DeleteResult = { success?: boolean; error?: string } & Record<string, unknown>;

interface Props {
  action: () => Promise<DeleteResult>;
  label?: string;
  confirmText?: string;
  /** Custom success message — receives the action's resolved value so
   *  the toast can include affected counts (e.g. "Ürün silindi, 3 iş için
   *  kalite temizlendi"). Default just toasts "Silindi". */
  formatSuccess?: (result: DeleteResult) => string;
}

export function DeleteButton({
  action,
  label = "Sil",
  confirmText = "Silmek istediğinize emin misiniz?",
  formatSuccess,
}: Props) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!confirm(confirmText)) return;
    startTransition(async () => {
      const r = await action();
      if (r.error) toast.error(r.error);
      else toast.success(formatSuccess ? formatSuccess(r) : "Silindi");
    });
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      disabled={pending}
      title={label}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
    </Button>
  );
}
