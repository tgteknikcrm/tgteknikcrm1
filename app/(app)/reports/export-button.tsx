"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { SHIFT_LABEL, type ProductionEntry } from "@/lib/supabase/types";
import { toast } from "sonner";

type Row = ProductionEntry & {
  machine_name?: string;
  operator_name?: string;
  job_label?: string;
};

interface Props {
  rows: Row[];
  from: string;
  to: string;
}

export function ExportButton({ rows, from, to }: Props) {
  async function onClick() {
    if (rows.length === 0) {
      toast.error("İndirilecek kayıt yok.");
      return;
    }
    try {
      const XLSX = await import("xlsx");
      const sheetRows = rows.map((r) => ({
        Tarih: r.entry_date,
        Vardiya: SHIFT_LABEL[r.shift],
        Makine: r.machine_name || "",
        Operatör: r.operator_name || "",
        İş: r.job_label || "",
        Üretim: r.produced_qty,
        Fire: r.scrap_qty,
        "Duruş (dk)": r.downtime_minutes,
        "Başlangıç Saati": r.start_time || "",
        "Bitiş Saati": r.end_time || "",
        Notlar: r.notes || "",
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(sheetRows);
      XLSX.utils.book_append_sheet(wb, ws, "Üretim");
      XLSX.writeFile(wb, `uretim-raporu-${from}_${to}.xlsx`);
    } catch (err) {
      toast.error("Export başarısız: " + (err as Error).message);
    }
  }

  return (
    <Button onClick={onClick} variant="outline">
      <Download className="size-4" /> Excel&apos;e Aktar
    </Button>
  );
}
