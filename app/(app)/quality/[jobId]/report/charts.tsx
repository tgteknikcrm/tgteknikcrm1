// QC Report charts — pure SVG so they look identical on screen and in
// the print-to-PDF flow. No JS runtime needed for rendering.

import type { QualitySpec, QualityMeasurement } from "@/lib/supabase/types";

/* ──────────────────────────────────────────────────────────
 * 1) Overall compliance stacked bar
 * ────────────────────────────────────────────────────────── */
export function OverallComplianceBar({
  ok,
  sinirda,
  nok,
}: {
  ok: number;
  sinirda: number;
  nok: number;
}) {
  const total = ok + sinirda + nok;
  if (total === 0) {
    return (
      <div className="text-sm text-muted-foreground italic text-center py-3">
        Henüz ölçüm yok.
      </div>
    );
  }
  const pctOk = (ok / total) * 100;
  const pctSinir = (sinirda / total) * 100;
  const pctNok = (nok / total) * 100;
  return (
    <div className="space-y-2">
      <div className="h-7 w-full rounded-md overflow-hidden flex border print:border-zinc-300">
        {ok > 0 && (
          <div
            className="bg-emerald-500 flex items-center justify-center text-white text-xs font-bold tabular-nums print:bg-emerald-500"
            style={{ width: `${pctOk}%` }}
          >
            {pctOk >= 8 && `OK ${ok} · %${pctOk.toFixed(0)}`}
          </div>
        )}
        {sinirda > 0 && (
          <div
            className="bg-amber-500 flex items-center justify-center text-white text-xs font-bold tabular-nums"
            style={{ width: `${pctSinir}%` }}
          >
            {pctSinir >= 8 && `${sinirda}`}
          </div>
        )}
        {nok > 0 && (
          <div
            className="bg-red-500 flex items-center justify-center text-white text-xs font-bold tabular-nums"
            style={{ width: `${pctNok}%` }}
          >
            {pctNok >= 8 && `NOK ${nok} · %${pctNok.toFixed(0)}`}
          </div>
        )}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-emerald-500" /> OK {ok}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-amber-500" /> Sınırda {sinirda}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-red-500" /> NOK {nok}
        </span>
        <span className="font-mono">Toplam {total}</span>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
 * 2) Per-spec mini distribution bar (sortable summary)
 * ────────────────────────────────────────────────────────── */
export function SpecDistributionTable({
  specs,
  measurements,
}: {
  specs: QualitySpec[];
  measurements: QualityMeasurement[];
}) {
  // Build per-spec summary
  const rows = specs.map((s) => {
    const own = measurements.filter((m) => m.spec_id === s.id);
    const ok = own.filter((m) => m.result === "ok").length;
    const sinir = own.filter((m) => m.result === "sinirda").length;
    const nok = own.filter((m) => m.result === "nok").length;
    return { spec: s, total: own.length, ok, sinir, nok };
  });

  // Sort: most NOK first, then most sınırda, then most measurements
  rows.sort((a, b) => {
    if (a.nok !== b.nok) return b.nok - a.nok;
    if (a.sinir !== b.sinir) return b.sinir - a.sinir;
    return b.total - a.total;
  });

  if (rows.every((r) => r.total === 0)) return null;

  return (
    <div className="rounded-lg border print:border-zinc-300 divide-y">
      {rows.map((r) => {
        if (r.total === 0) return null;
        const pctOk = (r.ok / r.total) * 100;
        const pctSinir = (r.sinir / r.total) * 100;
        const pctNok = (r.nok / r.total) * 100;
        const overallTone =
          r.nok > 0 ? "red" : r.sinir > 0 ? "amber" : "emerald";
        return (
          <div
            key={r.spec.id}
            className="grid grid-cols-12 gap-3 items-center px-3 py-2"
          >
            <div className="col-span-1 text-center font-mono text-xs font-bold tabular-nums text-muted-foreground">
              #{r.spec.bubble_no ?? "—"}
            </div>
            <div className="col-span-4 min-w-0">
              <div className="text-sm font-medium truncate flex items-center gap-1.5">
                {r.spec.is_critical && (
                  <span
                    className="size-1.5 rounded-full bg-red-500 shrink-0"
                    title="Kritik"
                  />
                )}
                {r.spec.description}
              </div>
              <div className="text-[10px] text-muted-foreground tabular-nums font-mono">
                {Number(r.spec.nominal_value).toFixed(3)} {r.spec.unit}
              </div>
            </div>
            <div className="col-span-5">
              <div className="h-3.5 w-full rounded-sm overflow-hidden flex border print:border-zinc-200">
                {r.ok > 0 && (
                  <div className="bg-emerald-500" style={{ width: `${pctOk}%` }} />
                )}
                {r.sinir > 0 && (
                  <div className="bg-amber-500" style={{ width: `${pctSinir}%` }} />
                )}
                {r.nok > 0 && (
                  <div className="bg-red-500" style={{ width: `${pctNok}%` }} />
                )}
              </div>
            </div>
            <div className="col-span-2 text-right text-xs tabular-nums font-mono">
              <span
                className={
                  overallTone === "red"
                    ? "text-red-700 font-bold"
                    : overallTone === "amber"
                    ? "text-amber-700"
                    : "text-emerald-700"
                }
              >
                {r.ok}/{r.total}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
 * 3) Tolerance band gauge per spec — measurement markers on a
 *    rectangle that represents the acceptable band.
 * ────────────────────────────────────────────────────────── */
export function ToleranceBandChart({
  spec,
  measurements,
}: {
  spec: QualitySpec;
  measurements: QualityMeasurement[];
}) {
  const own = measurements.filter((m) => m.spec_id === spec.id);
  const nominal = Number(spec.nominal_value);
  const tPlus = Number(spec.tolerance_plus);
  const tMinus = Number(spec.tolerance_minus);
  const lower = nominal - tMinus;
  const upper = nominal + tPlus;

  // Compute display range — pad 1.5× tolerance on each side so out-of-spec
  // measurements still show on screen (not infinite).
  const baseSpan = Math.max(tPlus, tMinus, 0.001);
  const padding = baseSpan * 1.5;
  let dispMin = lower - padding;
  let dispMax = upper + padding;
  for (const m of own) {
    const v = Number(m.measured_value);
    if (v < dispMin) dispMin = v - padding * 0.3;
    if (v > dispMax) dispMax = v + padding * 0.3;
  }
  const dispSpan = dispMax - dispMin || 1;

  // helper: percentage along x axis
  const pct = (v: number) => ((v - dispMin) / dispSpan) * 100;

  const okCount = own.filter((m) => m.result === "ok").length;
  const sinirCount = own.filter((m) => m.result === "sinirda").length;
  const nokCount = own.filter((m) => m.result === "nok").length;

  const minVal = own.length ? Math.min(...own.map((m) => Number(m.measured_value))) : null;
  const maxVal = own.length ? Math.max(...own.map((m) => Number(m.measured_value))) : null;
  const avgVal = own.length
    ? own.reduce((s, m) => s + Number(m.measured_value), 0) / own.length
    : null;

  return (
    <div className="rounded-lg border print:border-zinc-300 p-3 space-y-2">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-xs">
            #{spec.bubble_no ?? "?"}
          </span>
          <span className="font-medium text-sm">{spec.description}</span>
          {spec.is_critical && (
            <span className="text-[9px] font-bold text-red-700 bg-red-500/15 px-1.5 py-0.5 rounded">
              KRİTİK
            </span>
          )}
        </div>
        <div className="text-[10px] text-muted-foreground tabular-nums font-mono">
          {nominal.toFixed(3)} {spec.unit} · ±
          {tPlus === tMinus ? tPlus : `+${tPlus}/-${tMinus}`}
        </div>
      </div>

      {/* Gauge */}
      <div className="relative h-10 mt-1">
        {/* Out-of-spec backdrop (full width, light red) */}
        <div className="absolute inset-y-2 left-0 right-0 bg-red-500/10 rounded-sm" />
        {/* Tolerance band rectangle (green/amber transition) */}
        <div
          className="absolute inset-y-2 bg-emerald-500/25 border-y-2 border-emerald-500"
          style={{
            left: `${pct(lower)}%`,
            width: `${pct(upper) - pct(lower)}%`,
          }}
        />
        {/* Nominal centerline */}
        <div
          className="absolute inset-y-1 w-px bg-zinc-700"
          style={{ left: `${pct(nominal)}%` }}
          title={`Nominal: ${nominal}`}
        />

        {/* Measurement markers */}
        {own.map((m) => {
          const v = Number(m.measured_value);
          const color =
            m.result === "ok"
              ? "bg-emerald-600 border-emerald-800"
              : m.result === "sinirda"
              ? "bg-amber-500 border-amber-700"
              : "bg-red-600 border-red-800";
          return (
            <div
              key={m.id}
              className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-2.5 rounded-full border-2 ${color} shadow-sm`}
              style={{
                left: `${pct(v)}%`,
                zIndex: m.result === "nok" ? 30 : m.result === "sinirda" ? 20 : 10,
              }}
              title={`${m.part_serial ?? "—"}: ${v.toFixed(3)} ${spec.unit}`}
            />
          );
        })}

        {/* Axis labels */}
        <div
          className="absolute bottom-0 text-[9px] text-muted-foreground tabular-nums font-mono"
          style={{ left: `${pct(lower)}%`, transform: "translateX(-50%)" }}
        >
          {lower.toFixed(2)}
        </div>
        <div
          className="absolute bottom-0 text-[9px] font-bold tabular-nums font-mono"
          style={{ left: `${pct(nominal)}%`, transform: "translateX(-50%)" }}
        >
          {nominal.toFixed(2)}
        </div>
        <div
          className="absolute bottom-0 text-[9px] text-muted-foreground tabular-nums font-mono"
          style={{ left: `${pct(upper)}%`, transform: "translateX(-50%)" }}
        >
          {upper.toFixed(2)}
        </div>
      </div>

      {/* Stats footer */}
      {own.length > 0 ? (
        <div className="flex items-center justify-between text-[10px] tabular-nums font-mono pt-1 border-t print:border-zinc-200">
          <div className="flex gap-3">
            <span className="text-emerald-700">OK {okCount}</span>
            <span className="text-amber-700">Sınırda {sinirCount}</span>
            <span className={nokCount > 0 ? "text-red-700 font-bold" : "text-muted-foreground"}>
              NOK {nokCount}
            </span>
          </div>
          {avgVal !== null && minVal !== null && maxVal !== null && (
            <div className="flex gap-3 text-muted-foreground">
              <span>min {minVal.toFixed(3)}</span>
              <span>ort {avgVal.toFixed(3)}</span>
              <span>max {maxVal.toFixed(3)}</span>
              <span>n={own.length}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="text-[10px] text-muted-foreground italic pt-1 border-t print:border-zinc-200">
          Bu spec için ölçüm girilmemiş.
        </div>
      )}
    </div>
  );
}
