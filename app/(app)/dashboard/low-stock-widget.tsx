import Image from "next/image";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ArrowRight, Wrench } from "lucide-react";
import { toolImagePublicUrl, type Tool } from "@/lib/supabase/types";

export function LowStockWidget({ tools }: { tools: Tool[] }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-md bg-amber-500/15 flex items-center justify-center">
              <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Stok</div>
              <div className="text-sm font-semibold">Eksik Takım</div>
            </div>
          </div>
          <Link
            href="/tools"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
          >
            Tümü <ArrowRight className="size-3" />
          </Link>
        </div>

        {tools.length === 0 ? (
          <div className="rounded-lg border border-dashed py-6 text-center text-xs text-muted-foreground">
            Tüm takımlar yeterli stokta
          </div>
        ) : (
          <ul className="space-y-1.5">
            {tools.slice(0, 4).map((t) => {
              const url = toolImagePublicUrl(t.image_path);
              return (
                <li key={t.id} className="flex items-center gap-2 text-sm">
                  <div className="size-9 rounded-md border bg-muted/40 flex items-center justify-center overflow-hidden shrink-0">
                    {url ? (
                      <Image
                        src={url}
                        alt={t.name}
                        width={36}
                        height={36}
                        className="size-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <Wrench className="size-3.5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{t.name}</div>
                    {t.code && (
                      <div className="truncate text-[11px] text-muted-foreground font-mono">
                        {t.code}
                      </div>
                    )}
                  </div>
                  <Badge
                    variant="outline"
                    className="tabular-nums border-amber-300 text-amber-700 dark:text-amber-400 bg-amber-500/10"
                  >
                    {t.quantity} / {t.min_quantity}
                  </Badge>
                </li>
              );
            })}
            {tools.length > 4 && (
              <li className="text-[11px] text-muted-foreground text-center pt-1">
                +{tools.length - 4} daha
              </li>
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
