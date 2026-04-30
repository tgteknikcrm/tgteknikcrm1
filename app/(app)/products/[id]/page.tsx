import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Boxes,
  ClipboardList,
  Code2,
  FileImage,
  ImageIcon,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
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
import { LinkedFiles } from "./linked-files";
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

  const primaryImage = productImages.find((i) => i.is_primary) ?? productImages[0];
  const heroUrl = primaryImage
    ? productImagePublicUrl(primaryImage.image_path)
    : null;

  return (
    <div className="max-w-6xl mx-auto pb-8">
      <PageHeader
        title={product.name}
        description={
          <span className="inline-flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs">{product.code}</span>
            {product.revision && (
              <Badge variant="outline" className="text-xs">
                Rev. {product.revision}
              </Badge>
            )}
            <Badge
              variant="outline"
              className={cn("text-xs border", PRODUCT_STATUS_TONE[product.status])}
            >
              {PRODUCT_STATUS_LABEL[product.status]}
            </Badge>
            {product.customer && (
              <span className="text-xs text-muted-foreground">
                · {product.customer}
              </span>
            )}
          </span>
        }
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/products">
                <ArrowLeft className="size-4" /> Listeye Dön
              </Link>
            </Button>
            <DeleteButton
              action={async () => {
                "use server";
                return deleteProduct(product.id);
              }}
              confirmText={`'${product.code}' ürününü silmek istediğine emin misin? Bağlı işler/teknik resimler/CAD ile ilişki sıfırlanır.`}
            />
          </>
        }
      />

      {/* Hero with primary image + summary stats */}
      <Card className="mb-4 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-[14rem_1fr]">
          <div className="aspect-square md:aspect-auto bg-muted/40 flex items-center justify-center overflow-hidden">
            {heroUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={heroUrl}
                alt={product.name}
                className="size-full object-cover"
              />
            ) : (
              <ImageIcon className="size-12 text-muted-foreground/40" />
            )}
          </div>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="Kategori" value={product.category ?? "—"} />
              <Stat label="Malzeme" value={product.material ?? "—"} />
              <Stat
                label="Boyut"
                value={dimensionsLabel(product)}
              />
              <Stat
                label="Ağırlık"
                value={
                  product.weight_kg != null
                    ? `${product.weight_kg} kg`
                    : "—"
                }
              />
              <Stat label="Tolerans" value={product.tolerance_class ?? "—"} />
              <Stat label="Sertlik" value={product.hardness ?? "—"} />
              <Stat
                label="Yüzey İşlemi"
                value={product.surface_treatment ?? "—"}
              />
              <Stat
                label="Birim Fiyat"
                value={
                  product.unit_price != null
                    ? `${product.unit_price.toLocaleString("tr-TR")} ${product.currency ?? "TRY"}`
                    : "—"
                }
              />
            </div>
            {product.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {product.tags.map((t) => (
                  <Badge key={t} variant="secondary" className="text-[10px]">
                    {t}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </div>
      </Card>

      <Tabs defaultValue="info" className="mt-2">
        <TabsList>
          <TabsTrigger value="info" className="gap-1.5">
            <ClipboardList className="size-3.5" /> Bilgiler
          </TabsTrigger>
          <TabsTrigger value="images" className="gap-1.5">
            <ImageIcon className="size-3.5" /> Görseller
            <Badge variant="outline" className="h-4 ml-1 text-[9px]">
              {productImages.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="drawings" className="gap-1.5">
            <FileImage className="size-3.5" /> Teknik Resimler
            <Badge variant="outline" className="h-4 ml-1 text-[9px]">
              {dRes.data?.length ?? 0}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="cad" className="gap-1.5">
            <Code2 className="size-3.5" /> CAD/CAM
            <Badge variant="outline" className="h-4 ml-1 text-[9px]">
              {cRes.data?.length ?? 0}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="tools" className="gap-1.5">
            <Wrench className="size-3.5" /> Takımlar
            <Badge variant="outline" className="h-4 ml-1 text-[9px]">
              {productTools.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="jobs" className="gap-1.5">
            <Boxes className="size-3.5" /> İşler
            <Badge variant="outline" className="h-4 ml-1 text-[9px]">
              {jRes.data?.length ?? 0}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-3">
          <ProductForm
            product={product}
            existingTools={productTools}
            tools={tools}
            machines={machines}
          />
        </TabsContent>

        <TabsContent value="images" className="mt-3">
          <ProductImageGallery productId={product.id} images={productImages} />
        </TabsContent>

        <TabsContent value="drawings" className="mt-3">
          <LinkedFiles
            kind="drawings"
            productId={product.id}
            items={(dRes.data ?? []) as never}
          />
        </TabsContent>

        <TabsContent value="cad" className="mt-3">
          <LinkedFiles
            kind="cad"
            productId={product.id}
            items={(cRes.data ?? []) as never}
          />
        </TabsContent>

        <TabsContent value="tools" className="mt-3">
          <Card>
            <CardContent className="p-4">
              {productTools.length === 0 ? (
                <div className="text-sm text-muted-foreground italic py-6 text-center">
                  Henüz takım atanmadı. Bilgiler sekmesindeki formdan ekleyebilirsin.
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {productTools.map((pt) => {
                    const tool = tools.find((t) => t.id === pt.tool_id);
                    return (
                      <li
                        key={pt.tool_id}
                        className="flex items-center gap-3 px-2 py-1.5 rounded-md border bg-card"
                      >
                        <Wrench className="size-4 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">
                            {tool?.name ?? "Bilinmeyen takım"}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            {tool?.code ?? ""}
                            {tool?.size ? ` · ${tool.size}` : ""}
                          </div>
                        </div>
                        <Badge variant="outline" className="tabular-nums">
                          {pt.quantity_used} adet
                        </Badge>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="jobs" className="mt-3">
          <LinkedJobs items={(jRes.data ?? []) as never} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-sm font-medium truncate">{value}</div>
    </div>
  );
}

function dimensionsLabel(p: Product): string {
  const parts: string[] = [];
  if (p.length_mm != null) parts.push(`${p.length_mm}`);
  if (p.width_mm != null) parts.push(`${p.width_mm}`);
  if (p.height_mm != null) parts.push(`${p.height_mm}`);
  if (parts.length > 0) return `${parts.join(" × ")} mm`;
  if (p.diameter_mm != null) return `Ø${p.diameter_mm} mm`;
  return "—";
}
