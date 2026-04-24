import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import { TOOL_CONDITION_LABEL, type Tool } from "@/lib/supabase/types";
import { Plus, Wrench, AlertTriangle } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { SearchInput } from "@/components/app/search-input";
import { ToolDialog } from "./tool-dialog";
import { DeleteButton } from "../operators/delete-button";
import { deleteTool } from "./actions";

export const metadata = { title: "Takım Listesi" };

export default async function ToolsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  let tools: Tool[] = [];

  try {
    const supabase = await createClient();
    let query = supabase.from("tools").select("*").order("name");
    if (q) {
      query = query.or(
        `name.ilike.%${q}%,code.ilike.%${q}%,type.ilike.%${q}%,location.ilike.%${q}%`,
      );
    }
    const { data } = await query;
    tools = data ?? [];
  } catch {
    /* not configured */
  }

  return (
    <>
      <PageHeader
        title="Takım Listesi"
        description="Kullanılan tüm takım, bıçak ve araç-gereçler"
        actions={
          <>
            <SearchInput placeholder="Takım ara..." />
            <ToolDialog
              trigger={
                <Button>
                  <Plus className="size-4" /> Yeni Takım
                </Button>
              }
            />
          </>
        }
      />

      <Card>
        <CardContent className="p-0">
          {tools.length === 0 ? (
            <EmptyState
              icon={Wrench}
              title={q ? "Eşleşen takım yok" : "Henüz takım yok"}
              description={q ? "Arama terimini değiştirin." : "İlk takımı ekleyerek envanterini oluştur."}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kod</TableHead>
                  <TableHead>İsim</TableHead>
                  <TableHead>Tip / Ölçü</TableHead>
                  <TableHead>Konum</TableHead>
                  <TableHead className="text-right">Stok</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tools.map((t) => {
                  const low = t.quantity <= t.min_quantity;
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-mono text-xs">{t.code || "—"}</TableCell>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {[t.type, t.size, t.material].filter(Boolean).join(" · ") || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{t.location || "—"}</TableCell>
                      <TableCell className="text-right font-mono">
                        <span className={low ? "text-amber-600 font-semibold flex items-center justify-end gap-1" : ""}>
                          {low && <AlertTriangle className="size-3.5" />}
                          {t.quantity} / {t.min_quantity}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={t.condition === "degistirilmeli" ? "destructive" : "outline"}>
                          {TOOL_CONDITION_LABEL[t.condition]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <ToolDialog
                            tool={t}
                            trigger={
                              <Button variant="ghost" size="sm">
                                Düzenle
                              </Button>
                            }
                          />
                          <DeleteButton
                            action={async () => {
                              "use server";
                              return deleteTool(t.id);
                            }}
                            confirmText={`'${t.name}' silinsin mi?`}
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
