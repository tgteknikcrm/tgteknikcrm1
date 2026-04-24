"use client";

import { Input } from "@/components/ui/input";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";

export function SearchInput({
  placeholder = "Ara...",
  paramKey = "q",
}: {
  placeholder?: string;
  paramKey?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get(paramKey) ?? "");

  useEffect(() => {
    const t = setTimeout(() => {
      const p = new URLSearchParams(params.toString());
      if (value) p.set(paramKey, value);
      else p.delete(paramKey);
      router.replace(`${pathname}?${p.toString()}`);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="relative w-full sm:w-72">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="pl-9"
      />
    </div>
  );
}
