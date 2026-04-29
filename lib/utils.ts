import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Pin timezone to Istanbul so SSR (Vercel UTC) and client render the same
// string — without this we get React hydration mismatches whenever a date
// is rendered on the server (e.g. /quality/[jobId] reviews list).
const TR_TZ = "Europe/Istanbul";

export function formatDate(date: Date | string, locale = "tr-TR") {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: TR_TZ,
  });
}

export function formatDateTime(date: Date | string, locale = "tr-TR") {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TR_TZ,
  });
}

export function tr(text: string): string {
  return text;
}

// ── Period helpers (Europe/Istanbul) ─────────────────────────────────
// Returns YYYY-MM-DD for the current date in Europe/Istanbul.
export function turkeyTodayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TR_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export type ProductionPeriod = "day" | "week" | "month" | "year" | "all";

export const PRODUCTION_PERIOD_LABEL: Record<ProductionPeriod, string> = {
  day: "Bugün",
  week: "Bu Hafta",
  month: "Bu Ay",
  year: "Bu Yıl",
  all: "Tümü",
};

// Inclusive YYYY-MM-DD range for the requested period.
// "all" returns null (caller should not filter).
export function periodRange(
  period: ProductionPeriod,
  todayISO?: string,
): { from: string; to: string } | null {
  const today = todayISO ?? turkeyTodayISO();
  const [y, m, d] = today.split("-").map(Number);
  if (period === "all") return null;
  if (period === "day") return { from: today, to: today };
  if (period === "month") {
    return { from: `${y}-${String(m).padStart(2, "0")}-01`, to: today };
  }
  if (period === "year") {
    return { from: `${y}-01-01`, to: today };
  }
  if (period === "week") {
    // Week starts Monday in TR. UTC-based date math is timezone-safe here
    // because we operate purely on calendar days at 00:00 UTC.
    const utc = new Date(Date.UTC(y, m - 1, d));
    const dow = utc.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const offset = (dow + 6) % 7; // days since Monday
    const monday = new Date(Date.UTC(y, m - 1, d - offset));
    return { from: monday.toISOString().slice(0, 10), to: today };
  }
  return null;
}

// "29 Nis 2026 · Çarşamba" formatted from a YYYY-MM-DD string.
export function formatLongDateTR(iso: string): string {
  // Build a noon-UTC Date so the TR-day formatter cannot underflow.
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return new Intl.DateTimeFormat("tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: TR_TZ,
  }).format(date);
}
