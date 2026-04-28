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
