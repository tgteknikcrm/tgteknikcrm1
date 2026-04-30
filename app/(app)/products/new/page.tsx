import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { createClient } from "@/lib/supabase/server";
import type { Machine, Tool } from "@/lib/supabase/types";
import { ProductForm } from "../product-form";

export const metadata = { title: "Yeni Ürün" };

export default async function NewProductPage() {
  const supabase = await createClient();
  const [tRes, mRes] = await Promise.all([
    supabase.from("tools").select("*").order("name"),
    supabase.from("machines").select("id, name").order("name"),
  ]);
  const tools = (tRes.data ?? []) as Tool[];
  const machines = (mRes.data ?? []) as Pick<Machine, "id" | "name">[];

  return (
    <div className="max-w-5xl mx-auto pb-8">
      <PageHeader
        title="Yeni Ürün"
        description="Tekrar eden parçayı kapsamlı master kayıt olarak ekle"
        actions={
          <Button asChild variant="outline">
            <Link href="/products">
              <ArrowLeft className="size-4" /> Listeye Dön
            </Link>
          </Button>
        }
      />
      <ProductForm tools={tools} machines={machines} />
    </div>
  );
}
