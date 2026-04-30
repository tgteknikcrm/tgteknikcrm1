import Link from "next/link";
import { ArrowLeft, ImageIcon, Wrench, FileImage, Code2 } from "lucide-react";
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

      {/* Onboarding hint — what comes after Save */}
      <div className="mb-4 rounded-xl border bg-card p-4">
        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
          Kaydettikten sonra detay sayfasından eklenecekler
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Hint icon={ImageIcon} label="Ürün Görselleri" tone="primary" />
          <Hint icon={FileImage} label="Teknik Resimler" tone="blue" />
          <Hint icon={Code2} label="CAD/CAM Programları" tone="emerald" />
          <Hint icon={Wrench} label="Takımlar (aşağıda da var)" tone="amber" />
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          Form alttaki <strong>Oluştur</strong> butonuna basınca ürün
          kaydedilir ve <strong>detay sayfasına</strong> yönlendirilirsin.
          Görseller, teknik resimler ve CAD/CAM dosyalarını oradaki tab'lardan
          tek tıkla yükleyebilirsin.
        </p>
      </div>

      <ProductForm tools={tools} machines={machines} />
    </div>
  );
}

function Hint({
  icon: Icon,
  label,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tone: "primary" | "blue" | "emerald" | "amber";
}) {
  const tones: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    blue: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
    emerald: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    amber: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  };
  return (
    <div className="flex items-center gap-2 rounded-md bg-muted/40 px-2.5 py-2">
      <div
        className={`size-7 rounded-md flex items-center justify-center shrink-0 ${tones[tone]}`}
      >
        <Icon className="size-3.5" />
      </div>
      <span className="text-xs font-medium truncate">{label}</span>
    </div>
  );
}
