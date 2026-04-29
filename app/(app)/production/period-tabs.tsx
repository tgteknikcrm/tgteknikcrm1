"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  PRODUCTION_PERIOD_LABEL,
  type ProductionPeriod,
} from "@/lib/utils";

const ORDER: ProductionPeriod[] = ["day", "week", "month", "year", "all"];

export function PeriodTabs({ active }: { active: ProductionPeriod }) {
  const pathname = usePathname();
  const search = useSearchParams();

  function hrefFor(period: ProductionPeriod): string {
    const params = new URLSearchParams(search?.toString() ?? "");
    params.set("period", period);
    return `${pathname}?${params.toString()}`;
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-lg border bg-card p-1 shadow-sm">
      {ORDER.map((p) => {
        const isActive = p === active;
        return (
          <Link
            key={p}
            href={hrefFor(p)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {PRODUCTION_PERIOD_LABEL[p]}
          </Link>
        );
      })}
    </div>
  );
}
