"use client";

import { Button } from "@/components/ui/button";
import { Download, Printer } from "lucide-react";
import { toast } from "sonner";
import {
  QC_CHARACTERISTIC_LABEL,
  QC_RESULT_LABEL,
  formatToleranceBand,
  type QualitySpec,
  type QualityMeasurement,
} from "@/lib/supabase/types";

interface JobInfo {
  job_no: string | null;
  customer: string;
  part_name: string;
  part_no: string | null;
  quantity: number;
}

interface Props {
  job: JobInfo;
  specs: QualitySpec[];
  measurements: (QualityMeasurement & {
    spec_description?: string;
    spec_bubble_no?: number | null;
    operator_name?: string | null;
  })[];
}

export function ExportButtons({ job, specs, measurements }: Props) {
  function onPrint() {
    window.print();
  }

  async function onExcel() {
    if (specs.length === 0) {
      toast.error("Spec yok, dışa aktarılacak veri yok.");
      return;
    }
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();

      // Sheet 1: Spec'ler (FAI Form 3 stili)
      const specRows = specs.map((s) => {
        const own = measurements.filter((m) => m.spec_id === s.id);
        const ok = own.filter((m) => m.result === "ok").length;
        const sinir = own.filter((m) => m.result === "sinirda").length;
        const nok = own.filter((m) => m.result === "nok").length;
        return {
          "Balon No": s.bubble_no ?? "",
          Açıklama: s.description,
          Tip: QC_CHARACTERISTIC_LABEL[s.characteristic_type],
          Nominal: Number(s.nominal_value),
          "Tol +": Number(s.tolerance_plus),
          "Tol -": Number(s.tolerance_minus),
          Birim: s.unit,
          "Alt Sınır": Number(s.nominal_value) - Number(s.tolerance_minus),
          "Üst Sınır": Number(s.nominal_value) + Number(s.tolerance_plus),
          Alet: s.measurement_tool ?? "",
          Kritik: s.is_critical ? "Evet" : "Hayır",
          "Ölçüm Adedi": own.length,
          OK: ok,
          Sınırda: sinir,
          NOK: nok,
          Notlar: s.notes ?? "",
        };
      });
      const specSheet = XLSX.utils.json_to_sheet(specRows);
      XLSX.utils.book_append_sheet(wb, specSheet, "Spec'ler");

      // Sheet 2: Ölçümler (detay)
      const measRows = measurements.map((m) => ({
        Tarih: new Date(m.measured_at).toLocaleString("tr-TR"),
        "Balon No": m.spec_bubble_no ?? "",
        Spec: m.spec_description ?? "",
        "Parça Seri": m.part_serial ?? "",
        Ölçülen: Number(m.measured_value),
        Sonuç: QC_RESULT_LABEL[m.result],
        Alet: m.measurement_tool ?? "",
        Operatör: m.operator_name ?? "",
        Not: m.notes ?? "",
      }));
      const measSheet = XLSX.utils.json_to_sheet(measRows);
      XLSX.utils.book_append_sheet(wb, measSheet, "Ölçümler");

      // Sheet 3: Özet
      const okTotal = measurements.filter((m) => m.result === "ok").length;
      const sinirTotal = measurements.filter((m) => m.result === "sinirda").length;
      const nokTotal = measurements.filter((m) => m.result === "nok").length;
      const summary = [
        { "": "İş No", Değer: job.job_no ?? "—" },
        { "": "Müşteri", Değer: job.customer },
        { "": "Parça", Değer: job.part_name },
        { "": "Parça No", Değer: job.part_no ?? "—" },
        { "": "Planlı Adet", Değer: job.quantity },
        { "": "Spec Sayısı", Değer: specs.length },
        {
          "": "Kritik Spec",
          Değer: specs.filter((s) => s.is_critical).length,
        },
        { "": "Toplam Ölçüm", Değer: measurements.length },
        { "": "OK", Değer: okTotal },
        { "": "Sınırda", Değer: sinirTotal },
        { "": "NOK", Değer: nokTotal },
        {
          "": "Kabul Oranı (%)",
          Değer:
            measurements.length > 0
              ? ((okTotal / measurements.length) * 100).toFixed(1)
              : "—",
        },
      ];
      const summSheet = XLSX.utils.json_to_sheet(summary);
      XLSX.utils.book_append_sheet(wb, summSheet, "Özet");

      const fileBase =
        (job.job_no || "kalite-raporu").replace(/[^a-zA-Z0-9_-]/g, "_") +
        "-" +
        new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `${fileBase}.xlsx`);
      toast.success("Excel indirildi");
    } catch (err) {
      toast.error("Export başarısız: " + (err as Error).message);
    }
  }

  // Suppress unused warning — kept in API for future export-to-PDF feature
  void formatToleranceBand;

  return (
    <div className="flex gap-2 print:hidden">
      <Button variant="outline" onClick={onExcel}>
        <Download className="size-4" /> Excel
      </Button>
      <Button onClick={onPrint}>
        <Printer className="size-4" /> Yazdır / PDF
      </Button>
    </div>
  );
}
