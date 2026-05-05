import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/app/empty-state";
import {
  Scissors,
  Plus,
  Package,
  Box,
  MapPin,
  Hash,
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { type CutPieceWithRefs } from "@/lib/supabase/types";
import { CutDeleteButton } from "./cut-delete-button";

export const metadata = { title: "Kesim Stoğu" };

export default async function KesimStockPage() {
  const supabase = await createClient();

  const cutsRes = await supabase
    .from("cut_pieces")
    .select(
      `*,
       raw_material:raw_materials(id, code, name, shape, diameter_mm, material_grade),
       product:products(id, code, name)`,
    )
    .order("cut_at", { ascending: false })
    .limit(200);
  const cuts = (cutsRes.data ?? []) as CutPieceWithRefs[];

  const totals = {
    activeBatches: cuts.filter((c) => c.quantity_remaining > 0).length,
    totalRemaining: cuts.reduce((s, c) => s + c.quantity_remaining, 0),
    totalCutEver: cuts.reduce((s, c) => s + c.quantity_cut, 0),
  };

  return (
    <>
      <PageHeader
        title="Kesim Stoğu"
        description="Kesilmiş ve makineye gitmek üzere bekleyen parçalar."
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button asChild variant="outline">
              <Link href="/kesim/hammadde">
                <Box className="size-4" /> Hammadde
              </Link>
            </Button>
            <Button asChild>
              <Link href="/kesim/yeni">
                <Plus className="size-4" /> Yeni Kesim
              </Link>
            </Button>
          </div>
        }
      />

      {/* Summary chips */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <Stat
          label="Aktif Parti"
          value={totals.activeBatches}
          tone="bg-blue-500/10 text-blue-700 border-blue-500/30"
        />
        <Stat
          label="Stoktaki Parça"
          value={totals.totalRemaining}
          tone="bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
        />
        <Stat
          label="Toplam Kesilen"
          value={totals.totalCutEver}
          tone="bg-zinc-500/10 text-zinc-700 border-zinc-500/30"
        />
      </div>

      {cuts.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={Scissors}
              title="Henüz kesim kaydı yok"
              description="Önce hammadde tanımla, sonra kesim oluştur. Kesilen parçalar burada listelenir."
              action={
                <div className="flex gap-2">
                  <Button asChild variant="outline">
                    <Link href="/kesim/hammadde">
                      <Box className="size-4" /> Hammadde Ekle
                    </Link>
                  </Button>
                  <Button asChild>
                    <Link href="/kesim/yeni">
                      <Plus className="size-4" /> Yeni Kesim
                    </Link>
                  </Button>
                </div>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {cuts.map((c) => (
            <CutCard key={c.id} cut={c} />
          ))}
        </div>
      )}
    </>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className={`rounded-xl border p-3 ${tone}`}>
      <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">
        {label}
      </div>
      <div className="text-2xl font-bold tabular-nums leading-tight mt-0.5">
        {value}
      </div>
    </div>
  );
}

function CutCard({ cut: c }: { cut: CutPieceWithRefs }) {
  const exhausted = c.quantity_remaining === 0;
  const lowStock =
    c.quantity_remaining > 0 && c.quantity_remaining <= c.quantity_cut * 0.2;
  const accent = exhausted
    ? "border-l-zinc-300 dark:border-l-zinc-700 opacity-70"
    : lowStock
      ? "border-l-amber-500"
      : "border-l-emerald-500";

  return (
    <Card className={`border-l-4 ${accent} group relative`}>
      <CardContent className="p-4 space-y-2">
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition">
          <CutDeleteButton id={c.id} />
        </div>

        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {c.product ? (
              <Link
                href={`/products/${c.product.id}`}
                className="text-base font-semibold hover:underline truncate block"
              >
                {c.product.name}
              </Link>
            ) : (
              <div className="text-base font-semibold text-muted-foreground italic">
                — Stok için
              </div>
            )}
            <div className="text-xs text-muted-foreground font-mono mt-0.5">
              {c.product?.code ? `${c.product.code} · ` : ""}
              {c.raw_material?.code ?? "—"}
            </div>
          </div>
          <Badge
            variant="outline"
            className="tabular-nums text-base px-2 py-0.5 shrink-0"
          >
            {c.quantity_remaining}
            <span className="text-muted-foreground font-normal text-xs ml-1">
              / {c.quantity_cut}
            </span>
          </Badge>
        </div>

        <div className="text-sm text-muted-foreground space-y-0.5">
          <div className="flex items-center gap-1.5">
            <Hash className="size-3" />
            {c.cut_length_mm} mm uzunluk
            {c.raw_material?.diameter_mm && (
              <span> · Ø{c.raw_material.diameter_mm}mm</span>
            )}
            {c.raw_material?.material_grade && (
              <span> · {c.raw_material.material_grade}</span>
            )}
          </div>
          {c.location && (
            <div className="flex items-center gap-1.5">
              <MapPin className="size-3" />
              {c.location}
            </div>
          )}
          {c.lot_no && (
            <div className="flex items-center gap-1.5">
              <Package className="size-3" />
              Lot: {c.lot_no}
            </div>
          )}
        </div>

        <div className="text-[11px] text-muted-foreground tabular-nums pt-1 border-t">
          {formatDateTime(c.cut_at)}
        </div>

        {c.notes && (
          <p className="text-xs text-muted-foreground line-clamp-2 italic">
            {c.notes}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

