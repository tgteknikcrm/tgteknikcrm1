// Pure date-range helpers shared between server (page.tsx) and client
// (date-range-filter.tsx). NO 'use client' here — Next.js refuses to
// call functions exported from a 'use client' module from a server
// component, even if the function itself is a plain helper.

export type JobsPeriod = "day" | "week" | "month" | "year" | "all" | "custom";

export interface JobsRange {
  period: JobsPeriod;
  from: string | null; // ISO date (YYYY-MM-DD)
  to: string | null;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}
function startOfWeekTr(d: Date): Date {
  const day = d.getDay(); // 0=Sun .. 6=Sat
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  const r = new Date(d);
  r.setDate(d.getDate() + diff);
  return startOfDay(r);
}

export function computeJobsRange(value: JobsRange): {
  fromIso: string | null;
  toIso: string | null;
} {
  const now = new Date();
  switch (value.period) {
    case "all":
      return { fromIso: null, toIso: null };
    case "day": {
      return {
        fromIso: startOfDay(now).toISOString(),
        toIso: endOfDay(now).toISOString(),
      };
    }
    case "week": {
      const from = startOfWeekTr(now);
      const to = endOfDay(now);
      return { fromIso: from.toISOString(), toIso: to.toISOString() };
    }
    case "month": {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      const to = endOfDay(now);
      return { fromIso: from.toISOString(), toIso: to.toISOString() };
    }
    case "year": {
      const from = new Date(now.getFullYear(), 0, 1);
      const to = endOfDay(now);
      return { fromIso: from.toISOString(), toIso: to.toISOString() };
    }
    case "custom": {
      const fromIso = value.from
        ? startOfDay(new Date(value.from)).toISOString()
        : null;
      const toIso = value.to
        ? endOfDay(new Date(value.to)).toISOString()
        : value.from
          ? endOfDay(new Date(value.from)).toISOString()
          : null;
      return { fromIso, toIso };
    }
  }
}
