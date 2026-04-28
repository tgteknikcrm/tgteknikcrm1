import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import {
  QC_CHARACTERISTIC_LABEL,
  formatToleranceBand,
  formatToleranceRange,
  type Job,
  type QualitySpec,
  type QualityMeasurement,
} from "@/lib/supabase/types";
import { ArrowLeft } from "lucide-react";
import { ExportButtons } from "./export-buttons";
import { ResultBadge } from "../../result-badge";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Kalite Raporu" };

type MeasRow = QualityMeasurement & {
  specs?: Pick<
    QualitySpec,
    "id" | "bubble_no" | "description" | "nominal_value" | "unit"
  > | null;
  profile?: { full_name: string | null } | null;
};

export default async function QualityReportPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const supabase = await createClient();

  const [jobRes, specsRes, measRes] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, job_no, customer, part_name, part_no, quantity, status, due_date")
      .eq("id", jobId)
      .single(),
    supabase
      .from("quality_specs")
      .select("*")
      .eq("job_id", jobId)
      .order("bubble_no", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true }),
    supabase
      .from("quality_measurements")
      .select(
        `*, specs:quality_specs(id, bubble_no, description, nominal_value, unit),
         profile:profiles!quality_measurements_measured_by_fkey(full_name)`,
      )
      .eq("job_id", jobId)
      .order("measured_at", { ascending: true }),
  ]);

  if (jobRes.error || !jobRes.data) notFound();
  const job = jobRes.data as Pick<
    Job,
    "id" | "job_no" | "customer" | "part_name" | "part_no" | "quantity" | "due_date"
  >;
  const specs = (specsRes.data ?? []) as QualitySpec[];
  const measurements = (measRes.data ?? []) as MeasRow[];

  const measByPart = new Map<string, MeasRow[]>();
  for (const m of measurements) {
    const key = m.part_serial || "—";
    const arr = measByPart.get(key) ?? [];
    arr.push(m);
    measByPart.set(key, arr);
  }
  const partSerials = Array.from(measByPart.keys());

  const okTotal = measurements.filter((m) => m.result === "ok").length;
  const sinirTotal = measurements.filter((m) => m.result === "sinirda").length;
  const nokTotal = measurements.filter((m) => m.result === "nok").length;
  const okPct =
    measurements.length > 0 ? Math.round((okTotal / measurements.length) * 100) : 0;

  // Build matrix: [specId][partSerial] = measurement
  const matrix = new Map<string, Map<string, MeasRow>>();
  for (const m of measurements) {
    const sid = m.spec_id;
    const part = m.part_serial || "—";
    if (!matrix.has(sid)) matrix.set(sid, new Map());
    matrix.get(sid)!.set(part, m);
  }

  const enrichedMeasurements = measurements.map((m) => ({
    ...m,
    spec_description: m.specs?.description,
    spec_bubble_no: m.specs?.bubble_no,
    operator_name: m.profile?.full_name ?? null,
  }));

  return (
    <>
      <div className="mb-4 print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/quality/${jobId}`}>
            <ArrowLeft className="size-4" /> İş Detayına Dön
          </Link>
        </Button>
      </div>

      {/* Print-friendly header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Kalite Kontrol Raporu</h1>
          <p className="text-sm text-muted-foreground">
            TG Teknik · Üretim Kalite Kontrol Belgesi
          </p>
        </div>
        <ExportButtons
          job={{
            job_no: job.job_no,
            customer: job.customer,
            part_name: job.part_name,
            part_no: job.part_no,
            quantity: job.quantity,
          }}
          specs={specs}
          measurements={enrichedMeasurements}
        />
      </div>

      <div className="rounded-lg border print:border-0 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 p-4 text-sm">
          <Field label="İş No" value={job.job_no || "—"} />
          <Field label="Müşteri" value={job.customer} />
          <Field label="Parça" value={job.part_name} />
          <Field label="Parça No" value={job.part_no || "—"} />
          <Field label="Planlı Adet" value={String(job.quantity)} />
          <Field
            label="Teslim Tarihi"
            value={
              job.due_date
                ? new Date(job.due_date).toLocaleDateString("tr-TR")
                : "—"
            }
          />
          <Field label="Rapor Tarihi" value={new Date().toLocaleDateString("tr-TR")} />
          <Field label="Spec Sayısı" value={String(specs.length)} />
        </div>
      </div>

      {/* Özet */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 print:gap-2">
        <SummaryBlock label="Toplam Ölçüm" value={measurements.length} />
        <SummaryBlock label="OK" value={okTotal} tone="ok" />
        <SummaryBlock label="Sınırda" value={sinirTotal} tone="warn" />
        <SummaryBlock label="NOK" value={nokTotal} tone="bad" />
      </div>

      <div className="rounded-lg border p-4 mb-6 print:border-0">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-sm font-semibold">Kabul Oranı</span>
          <span className="text-2xl font-bold tabular-nums">%{okPct}</span>
        </div>
        {measurements.length > 0 && (
          <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden flex">
            <div
              className="h-full bg-emerald-500"
              style={{ width: `${(okTotal / measurements.length) * 100}%` }}
            />
            <div
              className="h-full bg-amber-500"
              style={{ width: `${(sinirTotal / measurements.length) * 100}%` }}
            />
            <div
              className="h-full bg-red-500"
              style={{ width: `${(nokTotal / measurements.length) * 100}%` }}
            />
          </div>
        )}
      </div>

      {/* FAI Form 3 stili — Karakteristik Sorumluluğu */}
      <h2 className="text-lg font-semibold mb-3 mt-6">
        Karakteristik Sorumluluğu (FAI Form 3 stili)
      </h2>

      {specs.length === 0 ? (
        <p className="text-sm text-muted-foreground p-6 text-center border rounded-lg">
          Bu iş için henüz spec tanımlanmamış.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border print:border-0">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 print:bg-zinc-100">
              <tr>
                <th className="p-2 text-center w-12">Balon</th>
                <th className="p-2 text-left">Karakteristik</th>
                <th className="p-2 text-right">Nominal</th>
                <th className="p-2 text-right">Tolerans</th>
                <th className="p-2 text-right">Aralık</th>
                <th className="p-2">Alet</th>
                <th className="p-2 text-center w-10">Krit.</th>
                {partSerials.length > 0 && partSerials.length <= 10 ? (
                  partSerials.map((p) => (
                    <th
                      key={p}
                      className="p-2 text-center font-mono"
                      style={{ minWidth: 70 }}
                    >
                      {p}
                    </th>
                  ))
                ) : (
                  <th className="p-2 text-center">Sonuç</th>
                )}
              </tr>
            </thead>
            <tbody>
              {specs.map((s) => {
                const ownMeas = measurements.filter((m) => m.spec_id === s.id);
                const ok = ownMeas.filter((m) => m.result === "ok").length;
                const sinir = ownMeas.filter((m) => m.result === "sinirda").length;
                const nok = ownMeas.filter((m) => m.result === "nok").length;
                return (
                  <tr key={s.id} className="border-t">
                    <td className="p-2 text-center font-mono font-bold tabular-nums">
                      {s.bubble_no ?? "—"}
                    </td>
                    <td className="p-2">
                      <div className="font-medium">{s.description}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {QC_CHARACTERISTIC_LABEL[s.characteristic_type]}
                      </div>
                    </td>
                    <td className="p-2 text-right font-mono tabular-nums">
                      {Number(s.nominal_value).toFixed(3)} {s.unit}
                    </td>
                    <td className="p-2 text-right font-mono tabular-nums">
                      {formatToleranceBand(
                        Number(s.tolerance_plus),
                        Number(s.tolerance_minus),
                      )}
                    </td>
                    <td className="p-2 text-right font-mono tabular-nums text-[10px] text-muted-foreground">
                      {formatToleranceRange(
                        Number(s.nominal_value),
                        Number(s.tolerance_plus),
                        Number(s.tolerance_minus),
                        s.unit,
                      )}
                    </td>
                    <td className="p-2">{s.measurement_tool || "—"}</td>
                    <td className="p-2 text-center">
                      {s.is_critical ? (
                        <span className="inline-block size-1.5 rounded-full bg-red-500" />
                      ) : (
                        ""
                      )}
                    </td>
                    {partSerials.length > 0 && partSerials.length <= 10 ? (
                      partSerials.map((p) => {
                        const m = matrix.get(s.id)?.get(p);
                        if (!m) {
                          return (
                            <td
                              key={p}
                              className="p-2 text-center text-muted-foreground"
                            >
                              —
                            </td>
                          );
                        }
                        const cls =
                          m.result === "ok"
                            ? "text-emerald-700"
                            : m.result === "sinirda"
                            ? "text-amber-700"
                            : "text-red-700 font-bold";
                        return (
                          <td
                            key={p}
                            className={`p-2 text-center font-mono tabular-nums ${cls}`}
                          >
                            {Number(m.measured_value).toFixed(3)}
                          </td>
                        );
                      })
                    ) : (
                      <td className="p-2 text-center text-xs">
                        {ownMeas.length === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span className="tabular-nums">
                            <span className="text-emerald-700 font-semibold">
                              {ok}
                            </span>
                            {" / "}
                            {sinir > 0 && (
                              <>
                                <span className="text-amber-700 font-semibold">
                                  {sinir}
                                </span>
                                {" / "}
                              </>
                            )}
                            <span
                              className={
                                nok > 0
                                  ? "text-red-700 font-bold"
                                  : "text-muted-foreground"
                              }
                            >
                              {nok}
                            </span>
                            {" / "}
                            <span className="text-muted-foreground">
                              {ownMeas.length}
                            </span>
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Eğer çok parça varsa, ölçüm detayı ayrı tablo */}
      {partSerials.length > 10 && (
        <>
          <h2 className="text-lg font-semibold mb-3 mt-6">Ölçüm Detayları</h2>
          <div className="rounded-lg border overflow-x-auto print:border-0">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 print:bg-zinc-100">
                <tr>
                  <th className="p-2 text-left">Tarih</th>
                  <th className="p-2 text-center">Balon</th>
                  <th className="p-2 text-left">Spec</th>
                  <th className="p-2 text-left">Parça</th>
                  <th className="p-2 text-right">Ölçülen</th>
                  <th className="p-2 text-left">Sonuç</th>
                  <th className="p-2 text-left">Operatör</th>
                </tr>
              </thead>
              <tbody>
                {measurements.map((m) => (
                  <tr key={m.id} className="border-t">
                    <td className="p-2 tabular-nums">
                      {formatDateTime(m.measured_at)}
                    </td>
                    <td className="p-2 text-center font-mono">
                      {m.specs?.bubble_no ?? "—"}
                    </td>
                    <td className="p-2">{m.specs?.description ?? "—"}</td>
                    <td className="p-2 font-mono">{m.part_serial || "—"}</td>
                    <td className="p-2 text-right font-mono tabular-nums">
                      {Number(m.measured_value).toFixed(3)}{" "}
                      {m.specs?.unit ?? ""}
                    </td>
                    <td className="p-2">
                      <ResultBadge result={m.result} />
                    </td>
                    <td className="p-2">{m.profile?.full_name ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* İmza alanları (yazdırma için) */}
      <div className="mt-12 grid grid-cols-3 gap-8 print:gap-12">
        <SignatureBlock label="Hazırlayan" />
        <SignatureBlock label="Kontrol Eden" />
        <SignatureBlock label="Onaylayan" />
      </div>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        {label}
      </div>
      <div className="text-sm font-medium mt-0.5">{value}</div>
    </div>
  );
}

function SummaryBlock({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "ok" | "warn" | "bad";
}) {
  const cls =
    tone === "ok"
      ? "text-emerald-700"
      : tone === "warn"
      ? "text-amber-700"
      : tone === "bad"
      ? "text-red-700"
      : "";
  return (
    <div className="rounded-lg border p-3 print:border-0 print:p-2">
      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        {label}
      </div>
      <div className={`text-3xl font-bold tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}

function SignatureBlock({ label }: { label: string }) {
  return (
    <div>
      <div className="border-t pt-2 text-center">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          {label}
        </div>
        <div className="text-sm h-12">&nbsp;</div>
      </div>
    </div>
  );
}
