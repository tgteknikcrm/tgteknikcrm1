"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { clearQualityForJob } from "../actions";

interface Props {
  jobId: string;
  partName: string;
  specCount: number;
  measurementCount: number;
}

export function ClearAllButton({
  jobId,
  partName,
  specCount,
  measurementCount,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  // Don't render if there's nothing to clear.
  if (specCount === 0 && measurementCount === 0) return null;

  function handleClick() {
    if (!confirming) {
      setConfirming(true);
      // Auto-revert if no follow-up click within 3s.
      setTimeout(() => setConfirming(false), 3000);
      return;
    }
    startTransition(async () => {
      const r = await clearQualityForJob(jobId);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(
        `'${partName}' temizlendi: ${r.removedSpecs} spec, ${r.removedMeasurements} ölçüm silindi`,
      );
      setConfirming(false);
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant={confirming ? "destructive" : "outline"}
      onClick={handleClick}
      disabled={pending}
      className="gap-1.5"
      title={`${specCount} spec + ${measurementCount} ölçüm silinecek (iş kalır)`}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Trash2 className="size-4" />
      )}
      {confirming
        ? "Onayla — Hepsini Sil"
        : `Hepsini Temizle (${specCount} + ${measurementCount})`}
    </Button>
  );
}
