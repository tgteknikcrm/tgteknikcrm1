"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Boxes, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { Product } from "@/lib/supabase/types";

/**
 * Reusable URL-driven product filter.
 *
 * Reads / writes `?product=<id>` on the current pathname so server pages
 * can re-filter from `searchParams`. Drop into headers next to the
 * search input.
 */
export function ProductFilter({
  products,
  paramKey = "product",
}: {
  products: Pick<Product, "id" | "code" | "name">[];
  paramKey?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get(paramKey) ?? "";

  function setValue(value: string) {
    const p = new URLSearchParams(params.toString());
    if (value && value !== "all") p.set(paramKey, value);
    else p.delete(paramKey);
    router.replace(`${pathname}?${p.toString()}`);
  }

  return (
    <div className="flex items-center gap-1">
      <Select value={current || "all"} onValueChange={setValue}>
        <SelectTrigger className="w-56 h-9">
          <Boxes className="size-4 text-muted-foreground" />
          <SelectValue placeholder="Tüm ürünler" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tüm ürünler</SelectItem>
          {products.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              <span className="font-mono text-xs mr-2">{p.code}</span>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {current && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setValue("")}
          className="size-8"
          title="Filtreyi temizle"
        >
          <X className="size-3.5" />
        </Button>
      )}
    </div>
  );
}
