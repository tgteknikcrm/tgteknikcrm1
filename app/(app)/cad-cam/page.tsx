import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  CAD_FILE_KIND_LABEL,
  detectCadFileKind,
  type CadProgram,
  type Machine,
  type Job,
} from "@/lib/supabase/types";
import { Code2, FileText, Box, FileCode, FileQuestion } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { SearchInput } from "@/components/app/search-input";
import { CadUploadDialog } from "./upload-dialog";
import { DownloadButton } from "./program-actions";
import { DeleteButton } from "../operators/delete-button";
import { deleteCadProgram } from "./actions";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "CAD/CAM" };

type ProgramRow = CadProgram & {
  machines?: { name: string } | null;
  jobs?: { job_no: string | null; part_name: string; customer: string } | null;
};

function fileSizeLabel(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function KindIcon({ kind }: { kind: ReturnType<typeof detectCadFileKind> }) {
  const cls = "size-4";
  switch (kind) {
    case "gcode":
      return <FileCode className={`${cls} text-emerald-600`} />;
    case "cad":
      return <Box className={`${cls} text-blue-600`} />;
    case "pdf":
      return <FileText className={`${cls} text-red-600`} />;
    case "doc":
      return <FileText className={`${cls} text-zinc-600`} />;
    default:
      return <FileQuestion className={`${cls} text-muted-foreground`} />;
  }
}

export default async function CadCamPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  let programs: ProgramRow[] = [];
  let machines: Pick<Machine, "id" | "name">[] = [];
  let jobs: Pick<Job, "id" | "job_no" | "customer" | "part_name">[] = [];
  let products: import("@/lib/supabase/types").Product[] = [];

  try {
    const supabase = await createClient();
    let pq = supabase
      .from("cad_programs")
      .select(`*, machines(name), jobs(job_no, part_name, customer)`)
      .order("created_at", { ascending: false });

    if (q) {
      pq = pq.or(`title.ilike.%${q}%,revision.ilike.%${q}%,notes.ilike.%${q}%`);
    }

    const [pRes, mRes, jRes, prRes] = await Promise.all([
      pq,
      supabase.from("machines").select("id, name").order("name"),
      supabase
        .from("jobs")
        .select("id, job_no, customer, part_name")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("products").select("*").order("code"),
    ]);
    programs = (pRes.data ?? []) as ProgramRow[];
    machines = mRes.data ?? [];
    jobs = jRes.data ?? [];
    products = prRes.data ?? [];
  } catch {
    /* not configured */
  }

  return (
    <>
      <PageHeader
        title="CAD/CAM"
        description="NC / G-code programları, CAD dosyaları, post-processor çıktıları."
        actions={
          <>
            <SearchInput placeholder="Başlık, revizyon, not..." />
            <CadUploadDialog machines={machines} jobs={jobs} products={products} />
          </>
        }
      />

      <Card>
        <CardContent className="p-0">
          {programs.length === 0 ? (
            <EmptyState
              icon={Code2}
              title={q ? "Eşleşen program yok" : "Henüz program yok"}
              description={
                q
                  ? "Farklı bir arama dene."
                  : "İlk NC / G-code / CAD dosyasını yükleyerek başla."
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Başlık</TableHead>
                  <TableHead>Tip</TableHead>
                  <TableHead>Makine</TableHead>
                  <TableHead>İş</TableHead>
                  <TableHead>Rev.</TableHead>
                  <TableHead className="text-right">Boyut</TableHead>
                  <TableHead>Tarih</TableHead>
                  <TableHead className="text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {programs.map((p) => {
                  const kind = detectCadFileKind(p.file_type, p.file_path);
                  return (
                    <TableRow key={p.id} className="hover:bg-muted/40">
                      <TableCell>
                        <div className="size-9 rounded-md border bg-muted/40 flex items-center justify-center">
                          <KindIcon kind={kind} />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{p.title}</div>
                        {p.notes && (
                          <div className="text-xs text-muted-foreground line-clamp-1">
                            {p.notes}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal">
                          {CAD_FILE_KIND_LABEL[kind]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {p.machines?.name || "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {p.jobs ? (
                          <div>
                            <div className="font-mono text-xs">
                              {p.jobs.job_no || "—"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {p.jobs.part_name}
                            </div>
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {p.revision || "—"}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                        {fileSizeLabel(p.file_size)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(p.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <DownloadButton path={p.file_path} />
                          <DeleteButton
                            action={async () => {
                              "use server";
                              return deleteCadProgram(p.id, p.file_path);
                            }}
                            confirmText={`'${p.title}' silinsin mi?`}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
