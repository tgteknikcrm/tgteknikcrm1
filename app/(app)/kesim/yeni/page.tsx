import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { ArrowLeft } from "lucide-react";
import {
  type Product,
  type RawMaterial,
} from "@/lib/supabase/types";
import { CutForm } from "./cut-form";

export const metadata = { title: "Yeni Kesim" };

export default async function YeniKesimPage({
  searchParams,
}: {
  searchParams: Promise<{ material?: string; product?: string }>;
}) {
  const { material: defaultMaterial, product: defaultProduct } =
    await searchParams;
  const supabase = await createClient();

  const [matRes, prodRes] = await Promise.all([
    supabase
      .from("raw_materials")
      .select("*")
      .eq("active", true)
      .gt("quantity", 0)
      .order("name"),
    supabase
      .from("products")
      .select("id, code, name, customer, status")
      .eq("status", "aktif")
      .order("name"),
  ]);

  const materials = (matRes.data ?? []) as RawMaterial[];
  const products = (prodRes.data ?? []) as Pick<
    Product,
    "id" | "code" | "name" | "customer" | "status"
  >[];

  return (
    <>
      <PageHeader
        title="Yeni Kesim"
        description="Hammaddeden parça kes — ürün için stok hazırla"
        actions={
          <Button asChild variant="outline">
            <Link href="/kesim">
              <ArrowLeft className="size-4" /> Kesim Stoğu
            </Link>
          </Button>
        }
      />

      <CutForm
        materials={materials}
        products={products}
        defaultMaterialId={defaultMaterial}
        defaultProductId={defaultProduct}
      />
    </>
  );
}
