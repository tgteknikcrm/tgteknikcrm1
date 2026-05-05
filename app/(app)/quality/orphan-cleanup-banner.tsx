"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cleanOrphanQualityData } from "./actions";

interface Props {
  /** Server-side count of orphan jobs (product_id null) with quality data. */
  initialCount: number;
}

/**
 * Banner that appears on /quality when there are jobs without a product
 * but with quality data attached (legacy orphans from before the cascade
 * landed in deleteProduct). Click → bulk clears.
 */
export function OrphanCleanupBanner({ initialCount }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [hidden, setHidden] = useState(initialCount === 0);

  if (hidden) return null;

  function handleClick() {
    if (!confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 4000);
      return;
    }
    startTransition(async () => {
      const r = await cleanOrphanQualityData();
      if ("error" in r && r.error) {
        toast.error(r.error);
        return;
      }
      const affected = r.affectedJobs ?? 0;
      const specs = r.removedSpecs ?? 0;
      const meas = r.removedMeasurements ?? 0;
      if (affected > 0) {
        toast.success(
          `Temizlendi · ${affected} sahipsiz iş için ${specs} spec + ${meas} ölçüm silindi`,
        );
      } else {
        toast.success("Temiz — orphan kayıt yok");
      }
      setHidden(true);
      router.refresh();
    });
  }

  return (
    <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 flex items-start gap-3">
      <AlertTriangle className="size-5 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-amber-900 dark:text-amber-200">
          {initialCount} sahipsiz iş için kalite verisi var
        </div>
        <div className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
          Ürünleri silinmiş (product_id boş) işlerin spec ve ölçüm kayıtları
          burada duruyor. Tek tıkla temizleyebilirsin — işler kendisi
          silinmez, sadece kalite verileri.
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        variant={confirming ? "destructive" : "outline"}
        onClick={handleClick}
        disabled={pending}
        className="gap-1.5 shrink-0"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Trash2 className="size-4" />
        )}
        {confirming ? "Onayla — Tümünü Sil" : "Sahipsiz Kalanları Temizle"}
      </Button>
    </div>
  );
}
