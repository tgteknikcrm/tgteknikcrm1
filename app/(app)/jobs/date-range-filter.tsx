"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarRange, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { JobsPeriod, JobsRange } from "./jobs-range";

export type { JobsPeriod, JobsRange };

const PRESET_BUTTONS: Array<{ key: JobsPeriod; label: string }> = [
  { key: "day", label: "Bugün" },
  { key: "week", label: "Bu Hafta" },
  { key: "month", label: "Bu Ay" },
  { key: "year", label: "Bu Yıl" },
  { key: "all", label: "Tümü" },
];

export function DateRangeFilter({
  value,
  onChange,
}: {
  value: JobsRange;
  onChange: (next: JobsRange) => void;
}) {
  const [customOpen, setCustomOpen] = useState(value.period === "custom");
  const [from, setFrom] = useState(value.from ?? "");
  const [to, setTo] = useState(value.to ?? "");

  // Sync external value back into local custom state when parent resets.
  useEffect(() => {
    if (value.period !== "custom") {
      setFrom("");
      setTo("");
    } else {
      setFrom(value.from ?? "");
      setTo(value.to ?? "");
    }
  }, [value.period, value.from, value.to]);

  function applyPreset(period: JobsPeriod) {
    setCustomOpen(period === "custom");
    if (period === "custom") return;
    onChange({ period, from: null, to: null });
  }

  function applyCustom(nextFrom: string, nextTo: string) {
    if (!nextFrom && !nextTo) {
      onChange({ period: "all", from: null, to: null });
      return;
    }
    onChange({
      period: "custom",
      from: nextFrom || null,
      to: nextTo || nextFrom,
    });
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <div className="inline-flex items-center rounded-lg border bg-card p-0.5 shadow-sm">
        {PRESET_BUTTONS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => applyPreset(p.key)}
            className={cn(
              "px-3 h-7 rounded-md text-xs font-medium transition",
              value.period === p.key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setCustomOpen((v) => !v)}
          className={cn(
            "px-3 h-7 rounded-md text-xs font-medium transition gap-1 inline-flex items-center",
            value.period === "custom" || customOpen
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted",
          )}
        >
          <CalendarRange className="size-3.5" />
          Özel
        </button>
      </div>

      {customOpen && (
        <div className="flex items-center gap-1.5 rounded-lg border bg-card p-1 shadow-sm">
          <Input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              applyCustom(e.target.value, to);
            }}
            className="h-7 text-xs w-36"
          />
          <span className="text-xs text-muted-foreground">→</span>
          <Input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              applyCustom(from, e.target.value);
            }}
            className="h-7 text-xs w-36"
          />
          {(from || to) && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => {
                setFrom("");
                setTo("");
                applyPreset("all");
              }}
              className="size-7"
              title="Temizle"
            >
              <X className="size-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

