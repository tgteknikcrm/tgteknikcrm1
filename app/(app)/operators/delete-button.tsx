"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  action: () => Promise<{ success?: boolean; error?: string }>;
  label?: string;
  confirmText?: string;
}

export function DeleteButton({ action, label = "Sil", confirmText = "Silmek istediğinize emin misiniz?" }: Props) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!confirm(confirmText)) return;
    startTransition(async () => {
      const r = await action();
      if (r.error) toast.error(r.error);
      else toast.success("Silindi");
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
