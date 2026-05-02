import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Boxes,
  ClipboardCheck,
  Code2,
  FileImage,
  ImageIcon,
  Pencil,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/server";
import {
  formatDurationDkSn,
  PRODUCT_PROCESS_LABEL,
  PRODUCT_STATUS_LABEL,
  PRODUCT_STATUS_TONE,
  productImagePublicUrl,
  type Machine,
  type Product,
  type ProductImage,
  type ProductTool,
  type Tool,
} from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { ProductForm } from "../product-form";
import { ProductImageGallery } from "../product-image-gallery";
import { DeleteButton } from "../../operators/delete-button";
import { deleteProduct } from "../actions";
import { ProductDrawingsTab } from "./product-drawings-tab";
import { ProductCadTab } from "./product-cad-tab";
import { ProductToolsTab } from "./product-tools-tab";
import { ProductQualityTab } from "./product-quality-tab";
import { LinkedJobs } from "./linked-jobs";

export const metadata = { title: "Ürün Detayı" };

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [pRes, ptRes, piRes, tRes, mRes, dRes, cRes, jRes] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).maybeSingle(),
    supabase.from("product_tools").select("*").eq("product_id", id),
    supabase
      .from("product_images")
      .select("*")
      .eq("product_id", id)
      .order("is_primary", { ascending: false })
      .order("sort_order", { ascending: true }),
    supabase.from("tools").select("*").order("name"),
    supabase.from("machines").select("id, name").order("name"),
    supabase
      .from("drawings")
      .select(
        "id, title, file_path, file_type, revision, created_at, annotations",
      )
      .eq("product_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("cad_programs")
      .select(
        "id, title, file_path, file_type, file_size, revision, created_at",
      )
      .eq("product_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("jobs")
      .select(
        "id, job_no, customer, part_name, quantity, status, due_date, created_at",
      )
      .eq("product_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const product = pRes.data as Product | null;
  if (!product) notFound();

  const productTools = (ptRes.data ?? []) as ProductTool[];
  const productImages = (piRes.data ?? []) as ProductImage[];
  const tools = (tRes.data ?? []) as Tool[];
  const machines = (mRes.data ?? []) as Pick<Machine, "id" | "name">[];
  const drawings = (dRes.data ?? []) as Array<{
    id: string;
    title: string;
    file_path: string;
    file_type: string | null;
    revision: string | null;
    created_at: string;
    annotations: unknown | null;
  }>;
  const cadPrograms = (cRes.data ?? []) as Array<{
    id: string;
    title: string;
    file_path: string;
    file_type: string | null;
    file_size: number | null;
    revision: string | null;
    created_at: string;
  }>;
  const jobs = (jRes.data ?? []) as Array<{
    id: string;
    job_no: string | null;
    customer: string;
    part_name: string;
    quantity: number;
    status: import("@/lib/supabase/types").JobStatus;
    due_date: string | null;
    created_at: string;
  }>;

  // Quality summary: aggregate spec/measurement counts per job (using
  // v_quality_summary if available, else raw queries).
  let qualityRows: Array<{
    job_id: string;
    job_no: string | null;
    customer: string;
    part_name: string;
    status: import("@/lib/supabase/types").JobStatus;
    spec_count: number;
    measurement_count: number;
    ok_count: number;
    nok_count: number;
  }> = [];
  if (jobs.length > 0) {
    const jobIds = jobs.map((j) => j.id);
    const [specsRes, measRes] = await Promise.all([
      supabase
        .from("quality_specs")
        .select("id, job_id")
        .in("job_id", jobIds),
      supabase
        .from("quality_measurements")
        .select("id, job_id, result")
        .in("job_id", jobIds),
    ]);
    const specsByJob = new Map<string, number>();
    for (const s of specsRes.data ?? []) {
      const jid = (s as { job_id: string }).job_id;
      specsByJob.set(jid, (specsByJob.get(jid) ?? 0) + 1);
    }
    const measStatsByJob = new Map<
      string,
      { total: number; ok: number; nok: number }
    >();
    for (const m of measRes.data ?? []) {
      const row = m as { job_id: string; result: string | null };
      const cur = measStatsByJob.get(row.job_id) ?? { total: 0, ok: 0, nok: 0 };
      cur.total += 1;
      if (row.result === "ok") cur.ok += 1;
      else if (row.result === "nok") cur.nok += 1;
      measStatsByJob.set(row.job_id, cur);
    }
    qualityRows = jobs
      .map((j) => {
        const specs = specsByJob.get(j.id) ?? 0;
        const stats = measStatsByJob.get(j.id);
        return {
          job_id: j.id,
          job_no: j.job_no,
          customer: j.customer,
          part_name: j.part_name,
          status: j.status,
          spec_count: specs,
          measurement_count: stats?.total ?? 0,
          ok_count: stats?.ok ?? 0,
          nok_count: stats?.nok ?? 0,
        };
      })
      .filter((r) => r.spec_count > 0 || r.measurement_count > 0);
  }

  const primaryImage =
    productImages.find((i) => i.is_primary) ?? productImages[0];
  const heroUrl = primaryImage
    ? productImagePublicUrl(primaryImage.image_path)
    : null;
  const defaultMachine = product.default_machine_id
    ? machines.find((m) => m.id === product.default_machine_id)
    : null;

  return (
    <div className="-m-4 md:-m-6 lg:-m-8">
      {/* ── Modern Hero ── */}
      <div className="relative overflow-hidden border-b">
        {/* Subtle gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,theme(colors.primary/8%),transparent_50%)]" />

        <div className="relative max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6">
          {/* Back nav */}
          <div className="flex items-center justify-between mb-4">
            <Button asChild variant="ghost" size="sm" className="gap-1.5">
              <Link href="/products">
                <ArrowLeft className="size-4" /> Ürünler
              </Link>
            </Button>
            <DeleteButton
              action={async () => {
                "use server";
                return deleteProduct(product.id);
              }}
              confirmText={`'${product.code}' ürününü silmek istediğine emin misin?`}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[16rem_1fr] gap-6">
            {/* Hero image */}
            <div className="relative aspect-square rounded-2xl border bg-card overflow-hidden shadow-md">
              {heroUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={heroUrl}
                  alt={product.name}
                  className="size-full object-cover"
                />
              ) : (
                <div className="size-full flex items-center justify-center bg-muted/40">
                  <ImageIcon className="size-16 text-muted-foreground/30" />
                </div>
              )}
              {productImages.length > 1 && (
                <div className="absolute bottom-2 right-2 px-2 py-1 rounded-full bg-black/60 text-white text-[10px] font-bold backdrop-blur-sm">
                  +{productImages.length - 1} görsel
                </div>
              )}
            </div>

            {/* Title + meta */}
            <div className="min-w-0 flex flex-col">
              <div className="flex items-start gap-2 flex-wrap mb-1">
                <span className="font-mono text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
                  {product.code}
                </span>
                {product.revision && (
                  <Badge variant="outline" className="text-[10px]">
                    Rev. {product.revision}
                  </Badge>
                )}
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] border",
                    PRODUCT_STATUS_TONE[product.status],
                  )}
                >
                  {PRODUCT_STATUS_LABEL[product.status]}
                </Badge>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight">
                {product.name}
              </h1>
              {product.customer && (
                <div className="text-sm text-muted-foreground mt-1">
                  {product.customer}
                  {product.customer_part_no && (
                    <span className="font-mono ml-2">
                      · {product.customer_part_no}
                    </span>
                  )}
                </div>
              )}
              {product.description && (
                <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
                  {product.description}
                </p>
              )}

              {/* Quick stats grid */}
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                <Stat label="Kategori" value={product.category ?? "—"} />
                <Stat label="Malzeme" value={product.material ?? "—"} />
                <Stat
                  label="Boyut"
                  value={dimensionsLabel(product)}
                  mono
                />
                <Stat
                  label="Ağırlık"
                  value={
                    product.weight_kg != null
                      ? `${product.weight_kg} kg`
                      : "—"
                  }
                  mono
                />
                <Stat
                  label="Tolerans"
                  value={product.tolerance_class ?? "—"}
                />
                <Stat label="Sertlik" value={product.hardness ?? "—"} />
                <Stat
                  label="Proses"
                  value={
                    product.process_type
                      ? PRODUCT_PROCESS_LABEL[product.process_type]
                      : "—"
                  }
                />
                <Stat
                  label="Birim Fiyat"
                  value={
                    product.unit_price != null
                      ? `${product.unit_price.toLocaleString("tr-TR")} ${product.currency ?? "TRY"}`
                      : "—"
                  }
                  mono
                />
                <Stat
                  label="İşleme Süresi"
                  value={
                    product.cycle_time_minutes != null
                      ? `${formatDurationDkSn(product.cycle_time_minutes)} / bağlama`
                      : "—"
                  }
                  mono
                />
                <Stat
                  label="Ayar Süresi"
                  value={
                    product.setup_time_minutes != null
                      ? formatDurationDkSn(product.setup_time_minutes)
                      : "—"
                  }
                  mono
                />
                <Stat
                  label="Bağlanan Adet"
                  value={
                    product.parts_per_setup != null
                      ? `${product.parts_per_setup}`
                      : "—"
                  }
                  mono
                />
              </div>

              {/* Tags + extra meta */}
              {(product.tags.length > 0 ||
                defaultMachine ||
                product.cycle_time_minutes ||
                product.surface_treatment) && (
                <div className="mt-3 flex flex-wrap gap-1.5 items-center">
                  {defaultMachine && (
                    <Badge variant="secondary" className="gap-1 text-[10px]">
                      <Wrench className="size-3" /> {defaultMachine.name}
                    </Badge>
                  )}
                  {product.cycle_time_minutes != null && (
                    <Badge variant="secondary" className="text-[10px]">
                      ⏱ {product.cycle_time_minutes} dk/parça
                    </Badge>
                  )}
                  {product.surface_treatment && (
                    <Badge variant="secondary" className="text-[10px]">
                      🎨 {product.surface_treatment}
                    </Badge>
                  )}
                  {product.tags.map((t) => (
                    <Badge
                      key={t}
                      variant="outline"
                      className="text-[10px]"
                    >
                      #{t}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6">
        <Tabs defaultValue="info">
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 py-2 mb-4 overflow-x-auto">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="info" className="gap-1.5">
                <Pencil className="size-3.5" /> Bilgiler
              </TabsTrigger>
              <TabsTrigger value="images" className="gap-1.5">
                <ImageIcon className="size-3.5" /> Görseller
                <Badge variant="outline" className="h-4 ml-1 text-[9px]">
                  {productImages.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="drawings" className="gap-1.5">
                <FileImage className="size-3.5" /> Teknik Resim
                <Badge variant="outline" className="h-4 ml-1 text-[9px]">
                  {drawings.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="cad" className="gap-1.5">
                <Code2 className="size-3.5" /> CAD/CAM
                <Badge variant="outline" className="h-4 ml-1 text-[9px]">
                  {cadPrograms.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="tools" className="gap-1.5">
                <Wrench className="size-3.5" /> Takımlar
                <Badge variant="outline" className="h-4 ml-1 text-[9px]">
                  {productTools.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="quality" className="gap-1.5">
                <ClipboardCheck className="size-3.5" /> Kalite
              </TabsTrigger>
              <TabsTrigger value="jobs" className="gap-1.5">
                <Boxes className="size-3.5" /> İşler
                <Badge variant="outline" className="h-4 ml-1 text-[9px]">
                  {jobs.length}
                </Badge>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="info">
            <ProductForm
              product={product}
              existingTools={productTools}
              tools={tools}
              machines={machines}
            />
          </TabsContent>

          <TabsContent value="images">
            <Card>
              <CardContent className="p-4">
                <ProductImageGallery
                  productId={product.id}
                  images={productImages}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="drawings">
            <ProductDrawingsTab productId={product.id} items={drawings} />
          </TabsContent>

          <TabsContent value="cad">
            <ProductCadTab
              productId={product.id}
              items={cadPrograms}
              machines={machines}
            />
          </TabsContent>

          <TabsContent value="tools">
            <ProductToolsTab
              productId={product.id}
              productTools={productTools}
              tools={tools}
            />
          </TabsContent>

          <TabsContent value="quality">
            <ProductQualityTab productId={product.id} items={qualityRows} />
          </TabsContent>

          <TabsContent value="jobs">
            <LinkedJobs items={jobs} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-card/60 backdrop-blur-sm px-3 py-2 min-w-0">
      <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "text-sm font-semibold truncate mt-0.5",
          mono && "font-mono",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function dimensionsLabel(p: Product): string {
  const parts: string[] = [];
  if (p.length_mm != null) parts.push(`${p.length_mm}`);
  if (p.width_mm != null) parts.push(`${p.width_mm}`);
  if (p.height_mm != null) parts.push(`${p.height_mm}`);
  if (parts.length > 0) return `${parts.join("×")} mm`;
  if (p.diameter_mm != null) return `Ø${p.diameter_mm} mm`;
  return "—";
}
