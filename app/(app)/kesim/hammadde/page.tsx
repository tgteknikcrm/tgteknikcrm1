import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
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
import { EmptyState } from "@/components/app/empty-state";
import { ArrowLeft, Box, Plus } from "lucide-react";
import {
  RAW_MATERIAL_SHAPE_LABEL,
  type RawMaterial,
} from "@/lib/supabase/types";
import { RawMaterialDialog } from "./raw-material-dialog";
import { DeleteButton } from "../../operators/delete-button";
import { deleteRawMaterial } from "../actions";

export const metadata = { title: "Hammadde — Kesim" };

export default async function HammaddePage() {
  const supabase = await createClient();
  const res = await supabase
    .from("raw_materials")
    .select("*")
    .order("active", { ascending: false })
    .order("name");
  const items = (res.data ?? []) as RawMaterial[];

  return (
    <>
      <PageHeader
        title="Hammadde Stoğu"
        description="Tedarikçiden gelen ham çubuk/plaka stoğu — kesim öncesi kayıt"
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button asChild variant="outline">
              <Link href="/kesim">
                <ArrowLeft className="size-4" /> Kesim Stoğu
              </Link>
            </Button>
            <RawMaterialDialog
              trigger={
                <Button>
                  <Plus className="size-4" /> Yeni Hammadde
                </Button>
              }
            />
          </div>
        }
      />

      {items.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={Box}
              title="Hammadde tanımı yok"
              description="Sisteme hammadde girince kesimde seçilebilir hâle gelir. Kod, malzeme ve boyut bilgisini gir."
              action={
                <RawMaterialDialog
                  trigger={
                    <Button>
                      <Plus className="size-4" /> İlk Hammaddeyi Ekle
                    </Button>
                  }
                />
              }
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kod</TableHead>
                  <TableHead>Ad</TableHead>
                  <TableHead>Tip / Malzeme</TableHead>
                  <TableHead>Boyut</TableHead>
                  <TableHead className="text-right">Stok</TableHead>
                  <TableHead>Konum</TableHead>
                  <TableHead className="text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((m) => (
                  <TableRow key={m.id} className={!m.active ? "opacity-60" : undefined}>
                    <TableCell className="font-mono text-xs">{m.code}</TableCell>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      <Badge variant="outline" className="text-[10px]">
                        {RAW_MATERIAL_SHAPE_LABEL[m.shape]}
                      </Badge>
                      {m.material_grade && (
                        <span className="ml-2">{m.material_grade}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums text-sm">
                      {[
                        m.diameter_mm && `Ø${m.diameter_mm}`,
                        m.width_mm && m.height_mm && `${m.width_mm}×${m.height_mm}`,
                        m.thickness_mm && `t${m.thickness_mm}`,
                        m.bar_length_mm && `${m.bar_length_mm} mm boy`,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      {m.quantity}{" "}
                      <span className="text-xs text-muted-foreground font-normal">
                        {m.unit}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {m.location || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <RawMaterialDialog
                          material={m}
                          trigger={
                            <Button variant="ghost" size="sm">
                              Düzenle
                            </Button>
                          }
                        />
                        <DeleteButton
                          action={() => deleteRawMaterial(m.id)}
                          confirmText={`'${m.name}' silinsin mi?`}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  );
}
