import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  TrendingUp,
} from "lucide-react";
import { JOB_STATUS_LABEL, type JobStatus } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

interface QualityJobItem {
  job_id: string;
  job_no: string | null;
  customer: string;
  part_name: string;
  status: JobStatus;
  spec_count: number;
  measurement_count: number;
  ok_count: number;
  nok_count: number;
}

interface Props {
  productId: string;
  items: QualityJobItem[];
}

const STATUS_VARIANT: Record<
  JobStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  beklemede: "secondary",
  uretimde: "default",
  tamamlandi: "outline",
  iptal: "destructive",
};

export function ProductQualityTab({ items }: Props) {
  // Aggregate stats across all jobs of this product.
  const totalSpecs = items.reduce((s, i) => s + i.spec_count, 0);
  const totalMeasurements = items.reduce(
    (s, i) => s + i.measurement_count,
    0,
  );
  const totalOk = items.reduce((s, i) => s + i.ok_count, 0);
  const totalNok = items.reduce((s, i) => s + i.nok_count, 0);
  const okRate =
    totalMeasurements > 0
      ? ((totalOk / totalMeasurements) * 100).toFixed(1)
      : null;

  return (
    <div className="space-y-3">
      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          icon={ClipboardCheck}
          label="Toplam Spec"
          value={totalSpecs}
          tone="blue"
        />
        <KpiCard
          icon={TrendingUp}
          label="Toplam Ölçüm"
          value={totalMeasurements}
          tone="emerald"
        />
        <KpiCard
          icon={CheckCircle2}
          label="OK"
          value={totalOk}
          subtitle={okRate ? `%${okRate} kabul` : undefined}
          tone="emerald"
        />
        <KpiCard
          icon={AlertTriangle}
          label="NOK"
          value={totalNok}
          tone={totalNok > 0 ? "rose" : "muted"}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="text-sm text-muted-foreground italic py-12 text-center">
              Bu üründen kalite kontrol kaydı olan iş yok.
              <div className="mt-1 text-[11px]">
                İş açıp Kalite sekmesinden spec/ölçüm girersen burada görünür.
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>İş No</TableHead>
                  <TableHead>Müşteri / Parça</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">Spec</TableHead>
                  <TableHead className="text-right">Ölçüm</TableHead>
                  <TableHead className="text-right">OK</TableHead>
                  <TableHead className="text-right">NOK</TableHead>
                  <TableHead className="text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it) => {
                  const okRate =
                    it.measurement_count > 0
                      ? (it.ok_count / it.measurement_count) * 100
                      : null;
                  return (
                    <TableRow key={it.job_id} className="hover:bg-muted/40">
                      <TableCell className="font-mono text-xs">
                        {it.job_no || "—"}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{it.customer}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {it.part_name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[it.status]}>
                          {JOB_STATUS_LABEL[it.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {it.spec_count}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {it.measurement_count}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span className="text-emerald-700 dark:text-emerald-300">
                          {it.ok_count}
                        </span>
                        {okRate != null && (
                          <span className="text-[10px] text-muted-foreground ml-1">
                            (%{okRate.toFixed(0)})
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span
                          className={cn(
                            it.nok_count > 0
                              ? "text-rose-700 dark:text-rose-300 font-semibold"
                              : "text-muted-foreground",
                          )}
                        >
                          {it.nok_count}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="outline" size="sm" className="gap-1.5">
                          <Link href={`/quality/${it.job_id}`}>
                            <ExternalLink className="size-3.5" /> Aç
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  subtitle,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  subtitle?: string;
  tone: "blue" | "emerald" | "rose" | "muted";
}) {
  const tones: Record<string, string> = {
    blue:
      "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
    emerald:
      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    rose: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30",
    muted: "bg-muted text-muted-foreground border-border",
  };
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div
          className={cn(
            "size-10 rounded-lg flex items-center justify-center border",
            tones[tone],
          )}
        >
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          <div className="text-2xl font-bold tabular-nums leading-tight">
            {value.toLocaleString("tr-TR")}
          </div>
          {subtitle && (
            <div className="text-[10px] text-muted-foreground">{subtitle}</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
