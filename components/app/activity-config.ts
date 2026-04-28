// Per-event metadata: icon, color tone, label parts, deep-link.
// Used by NotificationBell + /activity feed rendering.

import {
  FilePlus,
  FileEdit,
  FileX,
  ClipboardCheck,
  Wrench,
  Camera,
  Activity as ActivityIcon,
  Factory,
  Users,
  ShoppingCart,
  Truck,
  Image as ImageIcon,
  Stamp,
  Code2,
  AlertTriangle,
  Gauge,
  Ruler,
  RefreshCw,
  CircleAlert,
  UserPlus,
  UserMinus,
  UserCog,
  Hammer,
  type LucideIcon,
} from "lucide-react";
import type { ActivityEvent, ActivityEventType } from "@/lib/supabase/types";

export type ActivityCategory =
  | "kalite"
  | "uretim"
  | "is"
  | "makine"
  | "takim"
  | "operator"
  | "resim"
  | "siparis"
  | "tedarikci"
  | "cadcam"
  | "kullanici";

export type ActivityTone = "emerald" | "blue" | "red" | "amber" | "violet" | "zinc";

export interface EventMeta {
  icon: LucideIcon;
  tone: ActivityTone;
  category: ActivityCategory;
  // verb completes a sentence: "<actor> <verb> <entity_label?>"
  verb: (e: ActivityEvent) => string;
  // optional small footer detail (e.g. "Aktif → Arızalı", "12.45 mm")
  detail?: (e: ActivityEvent) => string | null;
  href?: (e: ActivityEvent) => string;
}

function meta(m: EventMeta): EventMeta {
  return m;
}

// Helper to safely read metadata fields without TS pain
function md(e: ActivityEvent, key: string): string | number | undefined {
  const v = e.metadata?.[key];
  if (typeof v === "string" || typeof v === "number") return v;
  return undefined;
}

export const EVENT_META: Record<ActivityEventType, EventMeta> = {
  // ─── Job ────────────────────────────────────────────────
  "job.created": meta({
    icon: FilePlus,
    tone: "blue",
    category: "is",
    verb: () => "yeni iş oluşturdu:",
    detail: (e) => {
      const c = md(e, "customer");
      const q = md(e, "quantity");
      return c ? `${c}${q ? ` · ${q} adet` : ""}` : null;
    },
    href: () => "/jobs",
  }),
  "job.updated": meta({
    icon: FileEdit,
    tone: "zinc",
    category: "is",
    verb: () => "iş güncelledi:",
    href: () => "/jobs",
  }),
  "job.deleted": meta({
    icon: FileX,
    tone: "red",
    category: "is",
    verb: () => "iş sildi:",
  }),
  "job.status_changed": meta({
    icon: RefreshCw,
    tone: "blue",
    category: "is",
    verb: () => "iş durumu değişti:",
    detail: (e) => {
      const f = md(e, "from_label");
      const t = md(e, "to_label");
      return f && t ? `${f} → ${t}` : null;
    },
    href: () => "/jobs",
  }),
  "job.tools_assigned": meta({
    icon: Wrench,
    tone: "blue",
    category: "is",
    verb: () => "işe takım atadı:",
    detail: (e) => {
      const c = md(e, "count");
      return c ? `${c} takım` : null;
    },
    href: () => "/jobs",
  }),

  // ─── Production ────────────────────────────────────────
  "production.created": meta({
    icon: Hammer,
    tone: "emerald",
    category: "uretim",
    verb: () => "üretim girdi:",
    href: () => "/production",
  }),

  // ─── Quality ───────────────────────────────────────────
  "spec.created": meta({
    icon: Ruler,
    tone: "blue",
    category: "kalite",
    verb: () => "kalite spec'i oluşturdu:",
    detail: (e) => {
      const b = md(e, "bubble_no");
      const n = md(e, "nominal");
      const u = md(e, "unit");
      return b !== undefined && n !== undefined
        ? `#${b} · ${n} ${u ?? ""}`
        : null;
    },
    href: (e) => {
      const j = md(e, "job_id");
      return j ? `/quality/${j}` : "/quality";
    },
  }),
  "spec.deleted": meta({
    icon: FileX,
    tone: "red",
    category: "kalite",
    verb: () => "kalite spec'i sildi:",
    href: () => "/quality",
  }),
  "measurement.created": meta({
    icon: Gauge,
    tone: "emerald",
    category: "kalite",
    verb: (e) =>
      md(e, "bulk")
        ? `${md(e, "count") ?? ""} ölçüm girdi (toplu):`
        : "ölçüm girdi:",
    detail: (e) => {
      const r = md(e, "result");
      const v = md(e, "measured");
      const ok = md(e, "ok");
      const nok = md(e, "nok");
      if (md(e, "bulk")) {
        return `${ok ?? 0} OK / ${nok ?? 0} NOK`;
      }
      return v !== undefined && r ? `${v} · ${String(r).toUpperCase()}` : null;
    },
    href: (e) => {
      const j = md(e, "job_id");
      return j ? `/quality/${j}` : "/quality";
    },
  }),
  "measurement.nok": meta({
    icon: AlertTriangle,
    tone: "red",
    category: "kalite",
    verb: () => "NOK ölçüm tespit edildi:",
    detail: (e) => {
      const v = md(e, "measured_value");
      return v !== undefined ? `${v}` : null;
    },
    href: () => "/quality",
  }),
  "review.created": meta({
    icon: Stamp,
    tone: "violet",
    category: "kalite",
    verb: (e) => {
      const r = md(e, "reviewer_role");
      return `kalite onayı (${r ?? "?"}):`;
    },
    detail: (e) => {
      const s = md(e, "status");
      return s ? String(s).toUpperCase() : null;
    },
    href: (e) => {
      const j = md(e, "job_id");
      return j ? `/quality/${j}` : "/quality";
    },
  }),

  // ─── Tools ─────────────────────────────────────────────
  "tool.created": meta({
    icon: Wrench,
    tone: "blue",
    category: "takim",
    verb: () => "yeni takım ekledi:",
    href: () => "/tools",
  }),
  "tool.deleted": meta({
    icon: FileX,
    tone: "red",
    category: "takim",
    verb: () => "takım sildi:",
  }),
  "tool.image_set": meta({
    icon: Camera,
    tone: "violet",
    category: "takim",
    verb: () => "takım resmi yükledi:",
    href: () => "/tools",
  }),

  // ─── Operators ─────────────────────────────────────────
  "operator.created": meta({
    icon: UserPlus,
    tone: "blue",
    category: "operator",
    verb: () => "operatör ekledi:",
    href: () => "/operators",
  }),
  "operator.updated": meta({
    icon: UserCog,
    tone: "zinc",
    category: "operator",
    verb: () => "operatör güncelledi:",
    href: () => "/operators",
  }),
  "operator.deleted": meta({
    icon: UserMinus,
    tone: "red",
    category: "operator",
    verb: () => "operatör sildi:",
  }),

  // ─── Machines ──────────────────────────────────────────
  "machine.created": meta({
    icon: Factory,
    tone: "blue",
    category: "makine",
    verb: () => "makine ekledi:",
    href: () => "/machines",
  }),
  "machine.status_changed": meta({
    icon: ActivityIcon,
    tone: "amber",
    category: "makine",
    verb: () => "makine durumu değişti:",
    detail: (e) => {
      const f = md(e, "from_label");
      const t = md(e, "to_label");
      return f && t ? `${f} → ${t}` : null;
    },
    href: (e) => (e.entity_id ? `/machines/${e.entity_id}` : "/machines"),
  }),
  "machine.deleted": meta({
    icon: FileX,
    tone: "red",
    category: "makine",
    verb: () => "makine sildi:",
  }),
  "machine.shift_assigned": meta({
    icon: Users,
    tone: "violet",
    category: "makine",
    verb: () => "vardiya atadı:",
    detail: (e) => {
      const s = md(e, "shift_label");
      const op = md(e, "operator");
      return s && op ? `${s} · ${op}` : null;
    },
    href: (e) => (e.entity_id ? `/machines/${e.entity_id}` : "/machines"),
  }),

  // ─── Drawings ──────────────────────────────────────────
  "drawing.uploaded": meta({
    icon: ImageIcon,
    tone: "blue",
    category: "resim",
    verb: () => "teknik resim yükledi:",
    href: () => "/drawings",
  }),
  "drawing.deleted": meta({
    icon: FileX,
    tone: "red",
    category: "resim",
    verb: () => "teknik resim sildi:",
  }),
  "drawing.annotated": meta({
    icon: ClipboardCheck,
    tone: "violet",
    category: "resim",
    verb: () => "teknik resim üzerinde işaret yaptı:",
    href: () => "/drawings",
  }),

  // ─── Orders ────────────────────────────────────────────
  "order.created": meta({
    icon: ShoppingCart,
    tone: "blue",
    category: "siparis",
    verb: () => "satın alma siparişi oluşturdu:",
    href: (e) => (e.entity_id ? `/orders/${e.entity_id}` : "/orders"),
  }),
  "order.status_changed": meta({
    icon: RefreshCw,
    tone: "amber",
    category: "siparis",
    verb: () => "sipariş durumu değişti:",
    detail: (e) => {
      const f = md(e, "from_label");
      const t = md(e, "to_label");
      return f && t ? `${f} → ${t}` : null;
    },
    href: (e) => (e.entity_id ? `/orders/${e.entity_id}` : "/orders"),
  }),
  "order.deleted": meta({
    icon: FileX,
    tone: "red",
    category: "siparis",
    verb: () => "sipariş sildi:",
  }),

  // ─── Suppliers / CAD-CAM ───────────────────────────────
  "supplier.created": meta({
    icon: Truck,
    tone: "blue",
    category: "tedarikci",
    verb: () => "tedarikçi ekledi:",
    href: () => "/suppliers",
  }),
  "cad.uploaded": meta({
    icon: Code2,
    tone: "blue",
    category: "cadcam",
    verb: () => "CAD/CAM programı yükledi:",
    href: () => "/cad-cam",
  }),
  "cad.deleted": meta({
    icon: FileX,
    tone: "red",
    category: "cadcam",
    verb: () => "CAD/CAM programı sildi:",
  }),

  // ─── Users (admin) ─────────────────────────────────────
  "user.created": meta({
    icon: UserPlus,
    tone: "violet",
    category: "kullanici",
    verb: () => "kullanıcı oluşturdu:",
    detail: (e) => {
      const r = md(e, "role");
      return r ? String(r) : null;
    },
    href: () => "/settings",
  }),
  "user.deleted": meta({
    icon: UserMinus,
    tone: "red",
    category: "kullanici",
    verb: () => "kullanıcı sildi:",
  }),
  "user.role_changed": meta({
    icon: UserCog,
    tone: "amber",
    category: "kullanici",
    verb: () => "kullanıcı rolü değişti:",
    detail: (e) => {
      const r = md(e, "new_role");
      return r ? String(r) : null;
    },
    href: () => "/settings",
  }),
};

export const TONE_CLASSES: Record<ActivityTone, { bg: string; text: string }> = {
  emerald: { bg: "bg-emerald-500/15", text: "text-emerald-700 dark:text-emerald-300" },
  blue:    { bg: "bg-blue-500/15",    text: "text-blue-700 dark:text-blue-300" },
  red:     { bg: "bg-red-500/15",     text: "text-red-700 dark:text-red-300" },
  amber:   { bg: "bg-amber-500/15",   text: "text-amber-700 dark:text-amber-300" },
  violet:  { bg: "bg-violet-500/15",  text: "text-violet-700 dark:text-violet-300" },
  zinc:    { bg: "bg-zinc-500/15",    text: "text-zinc-700 dark:text-zinc-300" },
};

export const CATEGORY_LABEL: Record<ActivityCategory, string> = {
  kalite: "Kalite",
  uretim: "Üretim",
  is: "İşler",
  makine: "Makine",
  takim: "Takım",
  operator: "Operatör",
  resim: "Resim",
  siparis: "Sipariş",
  tedarikci: "Tedarikçi",
  cadcam: "CAD/CAM",
  kullanici: "Kullanıcı",
};

// Group events into "Bugün / Dün / Bu hafta / Önceki" buckets.
export function groupEventsByDay(events: ActivityEvent[]): {
  label: string;
  items: ActivityEvent[];
}[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86400000;
  const weekAgo = today - 6 * 86400000;

  const buckets: { label: string; items: ActivityEvent[] }[] = [
    { label: "Bugün", items: [] },
    { label: "Dün", items: [] },
    { label: "Bu hafta", items: [] },
    { label: "Önceki", items: [] },
  ];
  for (const e of events) {
    const t = new Date(e.created_at).getTime();
    if (t >= today) buckets[0].items.push(e);
    else if (t >= yesterday) buckets[1].items.push(e);
    else if (t >= weekAgo) buckets[2].items.push(e);
    else buckets[3].items.push(e);
  }
  return buckets.filter((b) => b.items.length > 0);
}

// Friendly relative time: "şimdi", "5 dk", "2 saat", "3 gün"
export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "şimdi";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} dk`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} sa`;
  return `${Math.floor(diff / 86_400_000)} gün`;
}
