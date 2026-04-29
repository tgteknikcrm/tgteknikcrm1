"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface DecimalInputProps {
  /** Initial value. Component is uncontrolled — pass a stable key={...} on the parent
   *  to reset the inputs when the underlying record changes. */
  defaultValue?: number | null;
  onChange: (n: number | null) => void;
  /** Maximum number of fractional digits accepted (default 3). */
  decimals?: number;
  /** Minimum integer value for the whole-number input (default unbounded). */
  min?: number;
  className?: string;
  wholePlaceholder?: string;
  fracPlaceholder?: string;
  autoFocus?: boolean;
  required?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  id?: string;
  /** Allow negative whole-part input (default false — most QC values are non-negative). */
  allowNegative?: boolean;
  /** Visual size: "default" or "sm". */
  size?: "default" | "sm";
}

function splitNumber(n: number, decimals: number): { whole: string; frac: string } {
  if (!Number.isFinite(n)) return { whole: "", frac: "" };
  const fixed = n.toFixed(decimals);
  const [w, f = ""] = fixed.split(".");
  // Trim trailing zeros so users see "100" instead of "100.000" for integer values.
  const trimmedF = f.replace(/0+$/, "");
  return { whole: w, frac: trimmedF };
}

export function DecimalInput({
  defaultValue,
  onChange,
  decimals = 3,
  min,
  className,
  wholePlaceholder = "0",
  fracPlaceholder,
  autoFocus,
  required,
  disabled,
  ariaLabel,
  id,
  allowNegative = false,
  size = "default",
}: DecimalInputProps) {
  const fracRef = useRef<HTMLInputElement | null>(null);
  const init =
    defaultValue == null || !Number.isFinite(defaultValue)
      ? { whole: "", frac: "" }
      : splitNumber(defaultValue, decimals);
  const [whole, setWhole] = useState<string>(init.whole);
  const [frac, setFrac] = useState<string>(init.frac);

  function combine(w: string, f: string): number | null {
    if (w.trim() === "" && f.trim() === "") return null;
    const ws = w.trim() === "" ? "0" : w;
    const fs = f.trim() === "" ? "" : f;
    const combined = fs.length > 0 ? `${ws}.${fs}` : ws;
    const n = Number(combined);
    if (!Number.isFinite(n)) return null;
    if (min !== undefined && n < min) return null;
    return n;
  }

  function onWholeChange(e: React.ChangeEvent<HTMLInputElement>) {
    let v = e.target.value;
    v = allowNegative
      ? v.replace(/[^\d-]/g, "").replace(/(?!^)-/g, "")
      : v.replace(/\D/g, "");
    setWhole(v);
    onChange(combine(v, frac));
  }

  function onWholeKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "." || e.key === "," || e.key === "Decimal") {
      e.preventDefault();
      fracRef.current?.focus();
      fracRef.current?.select();
    }
  }

  function onFracChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value.replace(/\D/g, "").slice(0, decimals);
    setFrac(v);
    onChange(combine(whole, v));
  }

  function onFracKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // Backspace on empty fractional jumps back to whole
    if (e.key === "Backspace" && frac === "") {
      const prev = e.currentTarget.previousElementSibling
        ?.previousElementSibling as HTMLInputElement | null;
      if (prev) {
        e.preventDefault();
        prev.focus();
        const len = prev.value.length;
        try {
          prev.setSelectionRange(len, len);
        } catch {
          /* setSelectionRange unsupported on some input types */
        }
      }
    }
  }

  const heightClass = size === "sm" ? "h-8" : "h-9";
  const wholeWidth = size === "sm" ? "w-16" : "w-20";
  const fracWidth = size === "sm" ? "w-14" : "w-16";

  const inputClass = cn(
    heightClass,
    "rounded-md border border-input bg-background px-2 py-1",
    "text-base font-bold tabular-nums outline-none",
    "focus-visible:ring-2 focus-visible:ring-ring",
    disabled && "opacity-50 cursor-not-allowed",
  );

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <input
        id={id}
        type="text"
        inputMode={allowNegative ? "text" : "numeric"}
        value={whole}
        onChange={onWholeChange}
        onKeyDown={onWholeKeyDown}
        placeholder={wholePlaceholder}
        autoFocus={autoFocus}
        required={required}
        disabled={disabled}
        aria-label={ariaLabel ? `${ariaLabel} tam kısım` : "Tam kısım"}
        className={cn(inputClass, wholeWidth, "text-right")}
      />
      <span
        aria-hidden
        className="font-bold text-lg leading-none select-none text-muted-foreground px-0.5"
      >
        .
      </span>
      <input
        ref={fracRef}
        type="text"
        inputMode="numeric"
        value={frac}
        onChange={onFracChange}
        onKeyDown={onFracKeyDown}
        placeholder={fracPlaceholder ?? "0".repeat(decimals)}
        disabled={disabled}
        maxLength={decimals}
        aria-label={ariaLabel ? `${ariaLabel} ondalık kısım` : "Ondalık kısım"}
        className={cn(inputClass, fracWidth)}
      />
    </div>
  );
}
