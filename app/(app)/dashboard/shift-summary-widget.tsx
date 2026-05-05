import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Sun, Sunset, Moon } from "lucide-react";
import { SHIFT_LABEL, getCurrentShift, type Shift } from "@/lib/supabase/types";

export type ShiftSummaryRow = {
  machine_name: string;
  operator_name: string | null;
  produced: number;
  scrap: number;
};

const SHIFT_ICON: Record<Shift, typeof Sun> = {
  sabah: Sun,
  aksam: Sunset,
  gece: Moon,
};

export function ShiftSummaryWidget({ rows }: { rows: ShiftSummaryRow[] }) {
  const shift = getCurrentShift();
  const Icon = SHIFT_ICON[shift];
  const totalProduced = rows.reduce((s, r) => s + r.produced, 0);
  const totalScrap = rows.reduce((s, r) => s + r.scrap, 0);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-md bg-blue-500/15 flex items-center justify-center">
              <Icon className="size-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Vardiya</div>
              <div className="text-sm font-semibold">{SHIFT_LABEL[shift]}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold tabular-nums">
              {totalProduced}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {totalScrap > 0 ? `${totalScrap} fire` : "üretim"}
            </div>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed py-6 text-center text-xs text-muted-foreground">
            Bu vardiyada üretim girilmemiş
          </div>
        ) : (
          <ul className="space-y-1.5">
            {rows.slice(0, 5).map((r, i) => {
              const initials =
                r.operator_name
                  ?.split(" ")
                  .map((s) => s[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase() ?? "—";
              return (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <Avatar className="size-7 shrink-0">
                    <AvatarFallback className="text-[10px] font-semibold bg-blue-500/15 text-blue-600 dark:text-blue-400">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {r.machine_name}
                    </div>
                    {r.operator_name && (
                      <div className="truncate text-[11px] text-muted-foreground">
                        {r.operator_name}
                      </div>
                    )}
                  </div>
                  <Badge variant="outline" className="tabular-nums">
                    {r.produced}
                    {r.scrap > 0 && (
                      <span className="text-red-600 dark:text-red-400 ml-1">
                        −{r.scrap}
                      </span>
                    )}
                  </Badge>
                </li>
              );
            })}
            {rows.length > 5 && (
              <li className="text-[11px] text-muted-foreground text-center pt-1">
                +{rows.length - 5} daha
              </li>
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
