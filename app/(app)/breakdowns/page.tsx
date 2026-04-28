import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
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
import { createClient } from "@/lib/supabase/server";
import {
  TIMELINE_KIND_LABEL,
  type TimelineEntryKind,
} from "@/lib/supabase/types";
import {
  AlertTriangle,
  Wrench,
  Sparkles,
  Settings,
  CheckCircle2,
  Factory,
  Clock,
  Camera,
} from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { BreakdownDialog } from "./breakdown-dialog";
import { StatusButtons } from "./resolve-button";
import { formatDate, formatDateTime, cn } from "@/lib/utils";

export const metadata = { title: "Arıza & Bakım" };

const KIND_ICON: Partial<Record<TimelineEntryKind, typeof AlertTriangle>> = {
  ariza: AlertTriangle,
  bakim: Settings,
  temizlik: Sparkles,
  duzeltme: Wrench,
  parca_degisimi: Wrench,
  gozlem: AlertTriangle,
};

const KIND_TONE: Partial<Record<TimelineEntryKind, string>> = {
  ariza: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40",
  bakim: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/40",
  temizlik: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/40",
  duzeltme: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/40",
  parca_degisimi: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40",
};

const SEVERITY_LABEL: Record<number, { label: string; tone: string }> = {
  0: { label: "Düşük", tone: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300" },
  1: { label: "Orta", tone: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  2: { label: "Yüksek", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  3: { label: "Kritik", tone: "bg-red-500/15 text-red-700 dark:text-red-300" },
};

const STATUS_LABEL = {
  acik: { label: "Açık", tone: "bg-red-500/15 text-red-700 border-red-500/40" },
  devam: { label: "Devam", tone: "bg-amber-500/15 text-amber-700 border-amber-500/40" },
  cozuldu: { label: "Çözüldü", tone: "bg-emerald-500/15 text-emerald-700 border-emerald-500/40" },
} as const;

const RELEVANT_KINDS: TimelineEntryKind[] = [
  "ariza",
  "duzeltme",
  "parca_degisimi",
  "bakim",
  "temizlik",
  "gozlem",
];

interface Row {
  id: string;
  machine_id: string;
  machine_name: string | null;
  author_id: string | null;
  author_name: string | null;
  kind: TimelineEntryKind;
  title: string | null;
  body: string | null;
  photo_paths: string[];
  duration_minutes: number | null;
  severity_level: number | null;
  entry_status: keyof typeof STATUS_LABEL | null;
  resolved_at: string | null;
  fix_description: string | null;
  happened_at: string;
}

export default async function BreakdownsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; kind?: string }>;
}) {
  const { status, kind } = await searchParams;

  let rows: Row[] = [];
  let machines: { id: string; name: string }[] = [];

  try {
    const supabase = await createClient();

    let q = supabase
      .from("machine_timeline_entries")
      .select(
        `id, machine_id, author_id, author_name, kind, title, body,
         photo_paths, duration_minutes, severity_level, entry_status,
         resolved_at, fix_description, happened_at,
         machines(name)`,
      )
      .in("kind", RELEVANT_KINDS)
      .order("happened_at", { ascending: false })
      .limit(300);

    if (status === "acik" || status === "devam" || status === "cozuldu") {
      q = q.eq("entry_status", status);
    } else if (status === "open") {
      q = q.in("entry_status", ["acik", "devam"]);
    }
    if (kind && (RELEVANT_KINDS as string[]).includes(kind)) {
      q = q.eq("kind", kind);
    }

    const [rRes, mRes] = await Promise.all([
      q,
      supabase.from("machines").select("id, name").order("name"),
    ]);
    type RawRow = Omit<Row, "machine_name"> & {
      machines: { name: string } | null;
    };
    rows = ((rRes.data ?? []) as unknown as RawRow[]).map((r) => ({
      id: r.id,
      machine_id: r.machine_id,
      machine_name: r.machines?.name ?? null,
      author_id: r.author_id,
      author_name: r.author_name,
      kind: r.kind,
      title: r.title,
      body: r.body,
      photo_paths: (r.photo_paths ?? []) as string[],
      duration_minutes: r.duration_minutes,
      severity_level: r.severity_level,
      entry_status: r.entry_status,
      resolved_at: r.resolved_at,
      fix_description: r.fix_description,
      happened_at: r.happened_at,
    }));
    machines = mRes.data ?? [];
  } catch {
    /* not configured */
  }

  // Counts (full set, not filtered) for filter chips
  const all = rows.length;
  const open = rows.filter((r) => r.entry_status === "acik" || r.entry_status === "devam").length;
  const resolved = rows.filter((r) => r.entry_status === "cozuldu").length;

  return (
    <>
      <PageHeader
        title="Arıza & Bakım"
        description="Arıza, düzeltme, parça değişimi, bakım kayıtları — tek listede yönet."
        actions={<BreakdownDialog machines={machines} />}
      />

      <div className="flex gap-2 mb-4 flex-wrap">
        <FilterLink label={`Tümü (${all})`} href="/breakdowns" active={!status && !kind} />
        <FilterLink
          label={`Açık (${open})`}
          href="/breakdowns?status=open"
          active={status === "open"}
          tone="bad"
        />
        <FilterLink
          label={`Çözüldü (${resolved})`}
          href="/breakdowns?status=cozuldu"
          active={status === "cozuldu"}
          tone="ok"
        />
        <span className="border-l mx-1" />
        {RELEVANT_KINDS.map((k) => (
          <FilterLink
            key={k}
            label={TIMELINE_KIND_LABEL[k]}
            href={`/breakdowns?kind=${k}`}
            active={kind === k}
          />
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <EmptyState
              icon={AlertTriangle}
              title="Kayıt yok"
              description="Arıza/bakım kaydı oluşturarak başla."
              action={<BreakdownDialog machines={machines} />}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Başlık</TableHead>
                  <TableHead>Makine</TableHead>
                  <TableHead>Tip</TableHead>
                  <TableHead>Önem</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Yazan</TableHead>
                  <TableHead>Tarih</TableHead>
                  <TableHead className="text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const Icon = (r.kind && KIND_ICON[r.kind]) || AlertTriangle;
                  const tone = (r.kind && KIND_TONE[r.kind]) || "";
                  const sev =
                    r.severity_level !== null
                      ? SEVERITY_LABEL[r.severity_level]
                      : null;
                  const st = r.entry_status ? STATUS_LABEL[r.entry_status] : null;
                  return (
                    <TableRow key={r.id} className="hover:bg-muted/40">
                      <TableCell>
                        <div
                          className={cn(
                            "size-9 rounded-lg border flex items-center justify-center",
                            tone,
                          )}
                        >
                          <Icon className="size-4" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {r.title || "—"}
                          {r.photo_paths.length > 0 && (
                            <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                              <Camera className="size-3" />
                              {r.photo_paths.length}
                            </span>
                          )}
                        </div>
                        {r.body && (
                          <div className="text-xs text-muted-foreground line-clamp-1">
                            {r.body}
                          </div>
                        )}
                        {r.fix_description && (
                          <div className="text-[11px] text-emerald-700 mt-0.5 inline-flex items-center gap-1">
                            <CheckCircle2 className="size-3" />
                            Çözüm: {r.fix_description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.machine_id ? (
                          <Link
                            href={`/machines/${r.machine_id}`}
                            className="inline-flex items-center gap-1 text-sm hover:underline"
                          >
                            <Factory className="size-3.5 text-muted-foreground" />
                            {r.machine_name || "—"}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal">
                          {TIMELINE_KIND_LABEL[r.kind]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {sev ? (
                          <Badge variant="outline" className={sev.tone}>
                            {sev.label}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {st ? (
                          <Badge variant="outline" className={st.tone}>
                            {st.label}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                        {r.duration_minutes !== null && (
                          <div className="text-[10px] text-muted-foreground inline-flex items-center gap-0.5 mt-0.5 ml-1">
                            <Clock className="size-3" />
                            {r.duration_minutes}dk
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.author_name || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground tabular-nums">
                        {formatDateTime(r.happened_at)}
                        {r.resolved_at && (
                          <div className="text-emerald-700 text-[10px]">
                            ✓ {formatDate(r.resolved_at)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.entry_status && (
                          <StatusButtons
                            entryId={r.id}
                            currentStatus={r.entry_status}
                          />
                        )}
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

function FilterLink({
  label,
  href,
  active,
  tone,
}: {
  label: string;
  href: string;
  active: boolean;
  tone?: "bad" | "ok";
}) {
  const variant = active ? "default" : "outline";
  return (
    <Button
      asChild
      variant={variant}
      size="sm"
      className={cn(
        tone === "bad" && !active && "border-red-500/40 text-red-700",
        tone === "ok" && !active && "border-emerald-500/40 text-emerald-700",
      )}
    >
      <Link href={href}>{label}</Link>
    </Button>
  );
}
