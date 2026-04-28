import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import {
  formatToleranceBand,
  formatToleranceRange,
  isImageDrawing,
  QC_CHARACTERISTIC_EMOJI,
  QC_CHARACTERISTIC_LABEL,
  type Drawing,
  type Job,
  type QualitySpec,
  type QualityMeasurement,
} from "@/lib/supabase/types";
import {
  ArrowLeft,
  Plus,
  Ruler,
  Gauge,
  ListChecks,
  AlertCircle,
  ClipboardCheck,
  FileDown,
  ImageIcon,
} from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { ClientOnly } from "@/components/app/client-only";
import { SpecDialog } from "../spec-dialog";
import { MeasurementDialog } from "../measurement-dialog";
import { BulkMeasurementDialog } from "../bulk-measurement-dialog";
import { ReviewDialog } from "../review-dialog";
import { ResultBadge } from "../result-badge";
import { QcImageBoard } from "../image-board";
import { DeleteButton } from "../../operators/delete-button";
import { deleteSpec, deleteMeasurement, deleteQualityReview } from "../actions";
import { formatDateTime } from "@/lib/utils";
import {
  QC_REVIEWER_ROLE_LABEL,
  QC_REVIEW_STATUS_LABEL,
  QC_REVIEW_STATUS_TONE,
  type QualityReview,
} from "@/lib/supabase/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Stamp } from "lucide-react";

export const metadata = { title: "Kalite Kontrol — İş" };

type SpecRow = QualitySpec;
type MeasRow = QualityMeasurement & {
  specs?: Pick<
    QualitySpec,
    "id" | "bubble_no" | "description" | "nominal_value" | "unit"
  > | null;
  profile?: { full_name: string | null } | null;
};

export default async function QualityJobPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;

  const supabase = await createClient();

  const [jobRes, specsRes, measRes, reviewsRes, drawingsRes] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, job_no, customer, part_name, part_no, quantity, status")
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
      .order("measured_at", { ascending: false })
      .limit(200),
    supabase
      .from("quality_reviews")
      .select(`*, reviewer:profiles!quality_reviews_reviewer_id_fkey(full_name)`)
      .eq("job_id", jobId)
      .order("reviewed_at", { ascending: false }),
    supabase
      .from("drawings")
      .select("id, title, revision, file_path, file_type")
      .eq("job_id", jobId)
      .order("created_at", { ascending: false }),
  ]);

  // Build signed URLs for image drawings only — the QC image board overlay
  // doesn't currently work over PDFs (would need pdf.js). Filter accordingly.
  type DrawingShape = Pick<Drawing, "id" | "title" | "revision" | "file_path" | "file_type">;
  const allDrawings = (drawingsRes.data ?? []) as DrawingShape[];
  const imageDrawings = allDrawings.filter((d) => isImageDrawing(d));
  const drawingsForBoard = await Promise.all(
    imageDrawings.map(async (d) => {
      const { data } = await supabase.storage
        .from("drawings")
        .createSignedUrl(d.file_path, 60 * 30); // 30 dk
      return {
        id: d.id,
        title: d.title,
        revision: d.revision,
        signedUrl: data?.signedUrl ?? "",
      };
    }),
  );

  if (jobRes.error || !jobRes.data) notFound();
  const job = jobRes.data as Pick<
    Job,
    "id" | "job_no" | "customer" | "part_name" | "part_no" | "quantity" | "status"
  >;
  const specs = (specsRes.data ?? []) as SpecRow[];
  const measurements = (measRes.data ?? []) as MeasRow[];
  const reviews = (reviewsRes.data ?? []) as Array<
    QualityReview & { reviewer: { full_name: string | null } | null }
  >;

  const okCount = measurements.filter((m) => m.result === "ok").length;
  const sinirCount = measurements.filter((m) => m.result === "sinirda").length;
  const nokCount = measurements.filter((m) => m.result === "nok").length;
  const totalMeas = measurements.length;
  const okPct = totalMeas > 0 ? Math.round((okCount / totalMeas) * 100) : 0;

  // Next bubble number suggestion
  const usedBubbles = specs.map((s) => s.bubble_no ?? 0);
  const nextBubble = usedBubbles.length === 0 ? 1 : Math.max(...usedBubbles) + 1;

  return (
    <>
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/quality">
            <ArrowLeft className="size-4" /> Tüm Kalite Kontrol
          </Link>
        </Button>
      </div>

      {/* Hero */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-4">
          <div className="size-14 rounded-2xl flex items-center justify-center border bg-primary/10 text-primary">
            <ClipboardCheck className="size-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {job.part_name}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {job.job_no && (
                <span className="font-mono mr-2">{job.job_no}</span>
              )}
              {job.customer}
              {job.part_no && (
                <span className="font-mono"> · P/N {job.part_no}</span>
              )}
              <span className="ml-2">· {job.quantity} adet planlı</span>
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button asChild variant="outline">
            <Link href={`/quality/${jobId}/report`}>
              <FileDown className="size-4" /> Kalite Raporu
            </Link>
          </Button>
          {/* Dialog triggers wrapped in ClientOnly: avoids Radix useId mismatches
              between SSR and hydration when upstream subtrees differ slightly. */}
          <ClientOnly
            fallback={
              <>
                <Button variant="outline" disabled className="opacity-60">
                  <Stamp className="size-4" /> Onayla / İmzala
                </Button>
                <Button variant="secondary" disabled className="opacity-60">
                  <ListChecks className="size-4" /> Toplu Ölçüm
                </Button>
                <Button disabled className="opacity-60">
                  <Plus className="size-4" /> Yeni Spec
                </Button>
              </>
            }
          >
            <ReviewDialog
              jobId={jobId}
              trigger={
                <Button variant="outline">
                  <Stamp className="size-4" /> Onayla / İmzala
                </Button>
              }
            />
            <BulkMeasurementDialog
              jobId={jobId}
              specs={specs}
              trigger={
                <Button variant="secondary">
                  <ListChecks className="size-4" /> Toplu Ölçüm
                </Button>
              }
            />
            <SpecDialog
              jobId={jobId}
              defaultBubbleNo={nextBubble}
              trigger={
                <Button>
                  <Plus className="size-4" /> Yeni Spec
                </Button>
              }
            />
          </ClientOnly>
        </div>
      </div>

      {/* Quality Reviews — sign-off trail */}
      {reviews.length > 0 && (
        <Card className="mb-6">
          <CardContent className="p-4 space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-2">
              <Stamp className="size-3" /> Onay Zinciri ({reviews.length})
            </div>
            <div className="space-y-2">
              {reviews.map((r) => {
                const initials = (r.reviewer?.full_name || "?")
                  .split(" ")
                  .map((s) => s[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();
                return (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 p-2 rounded-lg border bg-muted/20"
                  >
                    <Avatar className="size-9 shrink-0">
                      <AvatarFallback className="text-xs font-semibold bg-primary/15 text-primary">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">
                          {r.reviewer?.full_name || "—"}
                        </span>
                        <Badge variant="outline" className="font-normal">
                          {QC_REVIEWER_ROLE_LABEL[r.reviewer_role]}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={QC_REVIEW_STATUS_TONE[r.status]}
                        >
                          {QC_REVIEW_STATUS_LABEL[r.status]}
                        </Badge>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {formatDateTime(r.reviewed_at)}
                        </span>
                      </div>
                      {r.notes && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {r.notes}
                        </p>
                      )}
                    </div>
                    <DeleteButton
                      action={async () => {
                        "use server";
                        return deleteQualityReview(r.id, jobId);
                      }}
                      confirmText="Bu onay silinsin mi?"
                    />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Kpi
          icon={Ruler}
          label="Spec Sayısı"
          value={specs.length}
          hint={`${specs.filter((s) => s.is_critical).length} kritik`}
        />
        <Kpi
          icon={Gauge}
          label="Toplam Ölçüm"
          value={totalMeas}
          hint={
            measurements[0]?.measured_at
              ? `son: ${formatDateTime(measurements[0].measured_at)}`
              : "henüz yok"
          }
        />
        <Kpi
          icon={ClipboardCheck}
          label="Kabul Oranı"
          value={`%${okPct}`}
          tone={
            totalMeas === 0 ? "muted" : okPct >= 95 ? "ok" : okPct >= 80 ? "warn" : "bad"
          }
          hint={`${okCount} OK / ${totalMeas}`}
        />
        <Kpi
          icon={AlertCircle}
          label="Reddedilen (NOK)"
          value={nokCount}
          tone={nokCount === 0 ? "muted" : "bad"}
          hint={sinirCount > 0 ? `${sinirCount} sınırda` : undefined}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue={drawingsForBoard.length > 0 ? "image" : "specs"}>
        <TabsList>
          <TabsTrigger value="image">
            <ImageIcon className="size-4" /> Resim Üzerinden
          </TabsTrigger>
          <TabsTrigger value="specs">
            <Ruler className="size-4" /> Spec'ler ({specs.length})
          </TabsTrigger>
          <TabsTrigger value="measurements">
            <Gauge className="size-4" /> Ölçümler ({totalMeas})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="image">
          <QcImageBoard
            jobId={jobId}
            drawings={drawingsForBoard.filter((d) => d.signedUrl)}
            specs={specs}
            measurements={measurements}
          />
        </TabsContent>

        <TabsContent value="specs">
          <Card>
            <CardContent className="p-0">
              {specs.length === 0 ? (
                <EmptyState
                  icon={Ruler}
                  title="Henüz spec yok"
                  description="Bu iş için ölçü tanımları ekleyerek başla. Teknik resimdeki balon numaralarını kullanabilirsin."
                  action={
                    <SpecDialog
                      jobId={jobId}
                      defaultBubbleNo={1}
                      trigger={
                        <Button>
                          <Plus className="size-4" /> Yeni Spec
                        </Button>
                      }
                    />
                  }
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16 text-center">Balon</TableHead>
                      <TableHead>Açıklama</TableHead>
                      <TableHead>Tip</TableHead>
                      <TableHead className="text-right">Nominal</TableHead>
                      <TableHead className="text-right">Tolerans</TableHead>
                      <TableHead className="text-right">Aralık</TableHead>
                      <TableHead>Alet</TableHead>
                      <TableHead className="text-center">Kritik</TableHead>
                      <TableHead className="text-right">İşlem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {specs.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="text-center font-mono font-bold tabular-nums text-muted-foreground">
                          {s.bubble_no ?? "—"}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{s.description}</div>
                          {s.notes && (
                            <div className="text-xs text-muted-foreground">
                              {s.notes}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal gap-1">
                            <span>
                              {QC_CHARACTERISTIC_EMOJI[s.characteristic_type]}
                            </span>
                            {QC_CHARACTERISTIC_LABEL[s.characteristic_type]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {Number(s.nominal_value).toFixed(3)}{" "}
                          <span className="text-xs text-muted-foreground">
                            {s.unit}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-sm">
                          {formatToleranceBand(
                            Number(s.tolerance_plus),
                            Number(s.tolerance_minus),
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground tabular-nums">
                          {formatToleranceRange(
                            Number(s.nominal_value),
                            Number(s.tolerance_plus),
                            Number(s.tolerance_minus),
                            s.unit,
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {s.measurement_tool || "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          {s.is_critical ? (
                            <span
                              className="inline-block size-2 rounded-full bg-red-500"
                              title="Kritik"
                            />
                          ) : (
                            <span className="text-muted-foreground/40">·</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <MeasurementDialog
                              spec={s}
                              trigger={
                                <Button variant="ghost" size="sm">
                                  + Ölçüm
                                </Button>
                              }
                            />
                            <SpecDialog
                              jobId={jobId}
                              spec={s}
                              trigger={
                                <Button variant="ghost" size="sm">
                                  Düzenle
                                </Button>
                              }
                            />
                            <DeleteButton
                              action={async () => {
                                "use server";
                                return deleteSpec(s.id, jobId);
                              }}
                              confirmText={`#${s.bubble_no ?? "?"} '${s.description}' spec'i silinsin mi? (Bağlı ölçümler de silinir.)`}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="measurements">
          <Card>
            <CardContent className="p-0">
              {measurements.length === 0 ? (
                <EmptyState
                  icon={Gauge}
                  title="Henüz ölçüm yok"
                  description="Spec'leri ekledikten sonra Toplu Ölçüm ile bir parçanın tüm ölçülerini sırayla girebilirsin."
                  action={
                    specs.length > 0 ? (
                      <BulkMeasurementDialog
                        jobId={jobId}
                        specs={specs}
                        trigger={
                          <Button>
                            <ListChecks className="size-4" /> Toplu Ölçüm
                          </Button>
                        }
                      />
                    ) : undefined
                  }
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tarih</TableHead>
                      <TableHead className="text-center">Balon</TableHead>
                      <TableHead>Spec</TableHead>
                      <TableHead>Parça</TableHead>
                      <TableHead className="text-right">Ölçülen</TableHead>
                      <TableHead className="text-right">Sapma</TableHead>
                      <TableHead>Sonuç</TableHead>
                      <TableHead>Operatör</TableHead>
                      <TableHead className="text-right">İşlem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {measurements.map((m) => {
                      const dev =
                        m.specs && Number.isFinite(Number(m.specs.nominal_value))
                          ? Number(m.measured_value) - Number(m.specs.nominal_value)
                          : null;
                      return (
                        <TableRow key={m.id}>
                          <TableCell className="text-xs text-muted-foreground tabular-nums">
                            {formatDateTime(m.measured_at)}
                          </TableCell>
                          <TableCell className="text-center font-mono tabular-nums text-muted-foreground">
                            {m.specs?.bubble_no ?? "—"}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">
                              {m.specs?.description ?? "—"}
                            </div>
                            {m.specs && (
                              <div className="text-xs text-muted-foreground tabular-nums font-mono">
                                {Number(m.specs.nominal_value).toFixed(3)}{" "}
                                {m.specs.unit}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {m.part_serial || "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold tabular-nums">
                            {Number(m.measured_value).toFixed(3)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-muted-foreground tabular-nums">
                            {dev === null
                              ? "—"
                              : `${dev >= 0 ? "+" : ""}${dev.toFixed(4)}`}
                          </TableCell>
                          <TableCell>
                            <ResultBadge result={m.result} />
                          </TableCell>
                          <TableCell className="text-sm">
                            {m.profile?.full_name || "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <DeleteButton
                              action={async () => {
                                "use server";
                                return deleteMeasurement(m.id, jobId);
                              }}
                              confirmText="Bu ölçüm silinsin mi?"
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: typeof Ruler;
  label: string;
  value: number | string;
  hint?: string;
  tone?: "default" | "ok" | "warn" | "bad" | "muted";
}) {
  const valueClass =
    tone === "ok"
      ? "text-emerald-600"
      : tone === "warn"
      ? "text-amber-600"
      : tone === "bad"
      ? "text-red-600"
      : tone === "muted"
      ? "text-muted-foreground"
      : "";
  const iconClass =
    tone === "ok"
      ? "text-emerald-600"
      : tone === "warn"
      ? "text-amber-600"
      : tone === "bad"
      ? "text-red-600"
      : "text-muted-foreground";
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {label}
            </div>
            <div
              className={`text-2xl font-semibold mt-1 tabular-nums ${valueClass}`}
            >
              {value}
            </div>
            {hint && (
              <div className="text-xs text-muted-foreground mt-1">{hint}</div>
            )}
          </div>
          <Icon className={`size-5 ${iconClass}`} />
        </div>
      </CardContent>
    </Card>
  );
}
