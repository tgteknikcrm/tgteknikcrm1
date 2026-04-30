import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Box,
  Code2,
  ExternalLink,
  FileCode,
  FileImage,
  FileQuestion,
  FileText,
} from "lucide-react";
import { detectCadFileKind, CAD_FILE_KIND_LABEL } from "@/lib/supabase/types";
import { formatDate } from "@/lib/utils";

interface DrawingItem {
  id: string;
  title: string;
  file_path: string;
  file_type: string | null;
  revision: string | null;
  created_at: string;
  annotations: unknown | null;
}

interface CadItem {
  id: string;
  title: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  revision: string | null;
  created_at: string;
}

interface Props {
  kind: "drawings" | "cad";
  productId: string;
  items: DrawingItem[] | CadItem[];
}

export function LinkedFiles({ kind, productId, items }: Props) {
  const href = kind === "drawings" ? "/drawings" : "/cad-cam";
  const filterHref = `${href}?product=${productId}`;
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {kind === "drawings"
              ? "Bu ürüne bağlı teknik resim/PDF'ler. Yeni dosya yüklemek için Teknik Resimler sayfasına git."
              : "Bu ürüne bağlı NC/G-code/CAD dosyaları. Yeni dosya yüklemek için CAD/CAM sayfasına git."}
          </div>
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href={filterHref}>
              <ExternalLink className="size-3.5" />
              {kind === "drawings" ? "Teknik Resimler" : "CAD/CAM"}
            </Link>
          </Button>
        </div>

        {items.length === 0 ? (
          <div className="text-sm text-muted-foreground italic py-6 text-center">
            Henüz dosya yüklenmedi.
          </div>
        ) : (
          <ul className="space-y-1.5">
            {items.map((it) => {
              if (kind === "drawings") {
                const d = it as DrawingItem;
                const isPdf =
                  d.file_type === "application/pdf" ||
                  d.file_path.toLowerCase().endsWith(".pdf");
                const isImg =
                  d.file_type?.startsWith("image/") ||
                  /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(d.file_path);
                const Icon = isPdf
                  ? FileText
                  : isImg
                    ? FileImage
                    : FileQuestion;
                return (
                  <li
                    key={d.id}
                    className="flex items-center gap-3 px-2 py-2 rounded-md border bg-card hover:bg-muted/40 transition"
                  >
                    <Icon className="size-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">
                        {d.title}
                        {d.annotations != null && (
                          <Badge
                            variant="outline"
                            className="ml-2 text-[9px] gap-1"
                          >
                            ✏️ Düzenli
                          </Badge>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {formatDate(d.created_at)}
                        {d.revision && ` · Rev. ${d.revision}`}
                      </div>
                    </div>
                  </li>
                );
              }
              const c = it as CadItem;
              const kindKey = detectCadFileKind(c.file_type, c.file_path);
              const Icon =
                kindKey === "gcode"
                  ? FileCode
                  : kindKey === "cad"
                    ? Box
                    : kindKey === "pdf"
                      ? FileText
                      : Code2;
              return (
                <li
                  key={c.id}
                  className="flex items-center gap-3 px-2 py-2 rounded-md border bg-card hover:bg-muted/40 transition"
                >
                  <Icon className="size-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{c.title}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {CAD_FILE_KIND_LABEL[kindKey]} · {formatDate(c.created_at)}
                      {c.revision && ` · Rev. ${c.revision}`}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
