import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import type { Drawing, Job } from "@/lib/supabase/types";
import { FileImage } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { UploadDialog } from "./upload-dialog";
import { ViewButton, DownloadButton, DeleteDrawingButton } from "./drawing-actions";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Teknik Resimler" };

function formatSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fileNameFromPath(path: string) {
  const base = path.split("/").pop() || path;
  return base.replace(/^\d+_/, "");
}

export default async function DrawingsPage() {
  let drawings: Array<Drawing & { job_label?: string }> = [];
  let jobs: Job[] = [];

  try {
    const supabase = await createClient();
    const [dRes, jRes] = await Promise.all([
      supabase
        .from("drawings")
        .select("*, jobs(job_no, customer, part_name)")
        .order("created_at", { ascending: false }),
      supabase.from("jobs").select("*").order("created_at", { ascending: false }),
    ]);

    type DrawingRow = Drawing & {
      jobs?: { job_no: string | null; customer: string; part_name: string } | null;
    };
    drawings = (dRes.data ?? []).map((d: DrawingRow) => ({
      ...d,
      job_label: d.jobs
        ? `${d.jobs.job_no ? d.jobs.job_no + " · " : ""}${d.jobs.customer} - ${d.jobs.part_name}`
        : undefined,
    }));
    jobs = jRes.data ?? [];
  } catch {
    /* not configured */
  }

  return (
    <>
      <PageHeader
        title="Teknik Resimler"
        description="Parça teknik resimleri ve çizimler (PDF, görsel, DWG/DXF)"
        actions={<UploadDialog jobs={jobs} />}
      />

      <Card>
        <CardContent className="p-0">
          {drawings.length === 0 ? (
            <EmptyState
              icon={FileImage}
              title="Henüz teknik resim yok"
              description="Bir iş için teknik resim yükleyerek başlayın."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Başlık</TableHead>
                  <TableHead>İş</TableHead>
                  <TableHead>Dosya</TableHead>
                  <TableHead>Revizyon</TableHead>
                  <TableHead>Boyut</TableHead>
                  <TableHead>Tarih</TableHead>
                  <TableHead className="text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drawings.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.title}</TableCell>
                    <TableCell className="text-sm max-w-xs truncate">{d.job_label || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{fileNameFromPath(d.file_path)}</TableCell>
                    <TableCell>
                      {d.revision ? <Badge variant="outline">{d.revision}</Badge> : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatSize(d.file_size)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(d.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-0.5 justify-end">
                        <ViewButton path={d.file_path} />
                        <DownloadButton path={d.file_path} fileName={fileNameFromPath(d.file_path)} />
                        <DeleteDrawingButton id={d.id} path={d.file_path} title={d.title} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
