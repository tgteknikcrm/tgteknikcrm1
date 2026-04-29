export type UserRole = "admin" | "operator";
export type MachineType = "Fanuc" | "Tekna" | "BWX" | "Diger";
export type MachineStatus = "aktif" | "durus" | "bakim" | "ariza";
export type Shift = "sabah" | "aksam" | "gece";
export type JobStatus = "beklemede" | "uretimde" | "tamamlandi" | "iptal";
export type ToolCondition = "yeni" | "iyi" | "kullanilabilir" | "degistirilmeli";
export type PoStatus =
  | "taslak"
  | "siparis_verildi"
  | "yolda"
  | "teslim_alindi"
  | "iptal";
export type PoItemCategory =
  | "takim"
  | "eldiven"
  | "kece"
  | "yag"
  | "kesici"
  | "asindirici"
  | "bakim_malzemesi"
  | "diger";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
  phone: string | null;
  avatar_url: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Machine {
  id: string;
  name: string;
  type: MachineType;
  model: string | null;
  serial_no: string | null;
  status: MachineStatus;
  location: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Operator {
  id: string;
  full_name: string;
  employee_no: string | null;
  phone: string | null;
  shift: Shift | null;
  active: boolean;
  profile_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MachineShiftAssignment {
  id: string;
  machine_id: string;
  shift: Shift;
  operator_id: string;
  notes: string | null;
  assigned_by: string | null;
  created_at: string;
  updated_at: string;
}

// Turkish manufacturing shift windows:
//   sabah  08:00–16:00  · aksam  16:00–24:00  · gece   00:00–08:00
export function getCurrentShift(now = new Date()): Shift {
  const h = now.getHours();
  if (h >= 8 && h < 16) return "sabah";
  if (h >= 16) return "aksam";
  return "gece";
}

export interface Tool {
  id: string;
  code: string | null;
  name: string;
  type: string | null;
  size: string | null;
  material: string | null;
  location: string | null;
  quantity: number;
  min_quantity: number;
  condition: ToolCondition;
  supplier: string | null;
  price: number | null;
  notes: string | null;
  image_path: string | null;
  created_at: string;
  updated_at: string;
}

// Public storage URL for a tool image. Bucket 'tool-images' is public, so
// we can build the URL from the path without a signed-URL round-trip.
export function toolImagePublicUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/tool-images/${path}`;
}

export interface Job {
  id: string;
  job_no: string | null;
  customer: string;
  part_name: string;
  part_no: string | null;
  quantity: number;
  machine_id: string | null;
  operator_id: string | null;
  status: JobStatus;
  priority: number;
  start_date: string | null;
  due_date: string | null;
  completed_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductionEntry {
  id: string;
  entry_date: string;
  shift: Shift;
  machine_id: string;
  operator_id: string | null;
  job_id: string | null;
  start_time: string | null;
  end_time: string | null;
  produced_qty: number;
  scrap_qty: number;
  downtime_minutes: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Drawing {
  id: string;
  job_id: string | null;
  title: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  revision: string | null;
  notes: string | null;
  uploaded_by: string | null;
  annotations: unknown | null;
  annotated_at: string | null;
  annotated_by: string | null;
  created_at: string;
}

export function isPdfDrawing(d: Pick<Drawing, "file_type" | "file_path">): boolean {
  if (d.file_type === "application/pdf") return true;
  return d.file_path.toLowerCase().endsWith(".pdf");
}

export function isImageDrawing(d: Pick<Drawing, "file_type" | "file_path">): boolean {
  if (d.file_type?.startsWith("image/")) return true;
  return /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(d.file_path);
}

export const MACHINE_STATUS_LABEL: Record<MachineStatus, string> = {
  aktif: "Aktif",
  durus: "Duruşta",
  bakim: "Bakımda",
  ariza: "Arızalı",
};

export const MACHINE_STATUS_COLOR: Record<MachineStatus, string> = {
  aktif: "bg-emerald-500",
  durus: "bg-zinc-400",
  bakim: "bg-amber-500",
  ariza: "bg-red-500",
};

// Card border + badge tint per status — used by dashboard machine cards.
export const MACHINE_STATUS_TONE: Record<
  MachineStatus,
  { border: string; badge: string; dot: string }
> = {
  aktif: {
    border: "border-l-emerald-500",
    badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    dot: "bg-emerald-500",
  },
  durus: {
    border: "border-l-zinc-400",
    badge: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30",
    dot: "bg-zinc-400",
  },
  bakim: {
    border: "border-l-amber-500",
    badge: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    dot: "bg-amber-500",
  },
  ariza: {
    border: "border-l-red-500",
    badge: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
    dot: "bg-red-500",
  },
};

export const SHIFT_LABEL: Record<Shift, string> = {
  sabah: "Sabah",
  aksam: "Akşam",
  gece: "Gece",
};

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  beklemede: "Beklemede",
  uretimde: "Üretimde",
  tamamlandi: "Tamamlandı",
  iptal: "İptal",
};

export const TOOL_CONDITION_LABEL: Record<ToolCondition, string> = {
  yeni: "Yeni",
  iyi: "İyi",
  kullanilabilir: "Kullanılabilir",
  degistirilmeli: "Değiştirilmeli",
};

export interface Supplier {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrder {
  id: string;
  order_no: string | null;
  supplier_id: string | null;
  status: PoStatus;
  order_date: string;
  expected_date: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderItem {
  id: string;
  order_id: string;
  category: PoItemCategory;
  description: string;
  tool_id: string | null;
  quantity: number;
  unit: string;
  unit_price: number | null;
  notes: string | null;
  created_at: string;
}

export const PO_STATUS_LABEL: Record<PoStatus, string> = {
  taslak: "Taslak",
  siparis_verildi: "Sipariş Verildi",
  yolda: "Yolda",
  teslim_alindi: "Teslim Alındı",
  iptal: "İptal",
};

export const PO_STATUS_TONE: Record<PoStatus, string> = {
  taslak: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30",
  siparis_verildi: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  yolda: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  teslim_alindi:
    "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  iptal: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
};

export const PO_ITEM_CATEGORY_LABEL: Record<PoItemCategory, string> = {
  takim: "Takım",
  eldiven: "Eldiven",
  kece: "Keçe",
  yag: "Yağ",
  kesici: "Kesici",
  asindirici: "Aşındırıcı",
  bakim_malzemesi: "Bakım Malzemesi",
  diger: "Diğer",
};

// Quick-add presets for the order form (label + default unit + tone color).
export const PO_ITEM_PRESETS: ReadonlyArray<{
  category: PoItemCategory;
  defaultUnit: string;
  emoji: string;
}> = [
  { category: "takim", defaultUnit: "adet", emoji: "🛠" },
  { category: "eldiven", defaultUnit: "çift", emoji: "🧤" },
  { category: "kece", defaultUnit: "adet", emoji: "🟫" },
  { category: "yag", defaultUnit: "lt", emoji: "🛢" },
  { category: "kesici", defaultUnit: "adet", emoji: "🔪" },
  { category: "asindirici", defaultUnit: "adet", emoji: "🪨" },
  { category: "bakim_malzemesi", defaultUnit: "adet", emoji: "🧰" },
  { category: "diger", defaultUnit: "adet", emoji: "📦" },
];

// ============================================================
// Quality Control
// ============================================================
export type QcCharacteristicType =
  | "boyut"
  | "gdt"
  | "yuzey"
  | "sertlik"
  | "agirlik"
  | "diger";

export type QcResult = "ok" | "sinirda" | "nok";

export interface QualitySpec {
  id: string;
  job_id: string;
  bubble_no: number | null;
  characteristic_type: QcCharacteristicType;
  description: string;
  nominal_value: number;
  tolerance_plus: number;
  tolerance_minus: number;
  unit: string;
  measurement_tool: string | null;
  is_critical: boolean;
  drawing_id: string | null;
  // Normalized coords (0..1) on the linked drawing — survives resize.
  bubble_x: number | null;
  bubble_y: number | null;
  // Optional per-spec override color (hex or tailwind tone name).
  bubble_color: string | null;
  // Bubble visual style on the drawing.
  bubble_size: BubbleSize;
  bubble_shape: BubbleShape;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Bubble color presets (used in QC image board picker) — 14 + auto + custom
export const BUBBLE_COLOR_PRESETS: ReadonlyArray<{ key: string; bg: string; name: string }> = [
  { key: "auto", bg: "", name: "Otomatik (sonuca göre)" },
  { key: "#10b981", bg: "bg-emerald-500", name: "Yeşil" },
  { key: "#14b8a6", bg: "bg-teal-500", name: "Teal" },
  { key: "#06b6d4", bg: "bg-cyan-500", name: "Cyan" },
  { key: "#3b82f6", bg: "bg-blue-500", name: "Mavi" },
  { key: "#6366f1", bg: "bg-indigo-500", name: "İndigo" },
  { key: "#8b5cf6", bg: "bg-violet-500", name: "Mor" },
  { key: "#a855f7", bg: "bg-purple-500", name: "Erguvan" },
  { key: "#ec4899", bg: "bg-pink-500", name: "Pembe" },
  { key: "#f43f5e", bg: "bg-rose-500", name: "Gül" },
  { key: "#ef4444", bg: "bg-red-500", name: "Kırmızı" },
  { key: "#f97316", bg: "bg-orange-500", name: "Turuncu" },
  { key: "#f59e0b", bg: "bg-amber-500", name: "Sarı" },
  { key: "#84cc16", bg: "bg-lime-500", name: "Limon" },
  { key: "#1f2937", bg: "bg-zinc-800", name: "Siyah" },
];

// ── Bubble size + shape ──────────────────────────────────────────────
export type BubbleSize = "sm" | "md" | "lg" | "xl";
export type BubbleShape =
  | "circle"
  | "square"
  | "diamond"
  | "triangle"
  | "hexagon"
  | "star";

export const BUBBLE_SIZE_PRESETS: ReadonlyArray<{
  key: BubbleSize;
  px: number;
  fontPx: number;
  name: string;
}> = [
  { key: "sm", px: 22, fontPx: 10, name: "Küçük" },
  { key: "md", px: 28, fontPx: 12, name: "Orta" },
  { key: "lg", px: 36, fontPx: 14, name: "Büyük" },
  { key: "xl", px: 48, fontPx: 18, name: "Çok Büyük" },
];

// clip-path polygons for non-trivial shapes; circle/square handled via border-radius.
export const BUBBLE_SHAPE_PRESETS: ReadonlyArray<{
  key: BubbleShape;
  name: string;
  clipPath?: string;
  borderRadius?: string;
}> = [
  { key: "circle", name: "Daire", borderRadius: "9999px" },
  { key: "square", name: "Kare", borderRadius: "6px" },
  {
    key: "diamond",
    name: "Baklava",
    clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
  },
  {
    key: "triangle",
    name: "Üçgen",
    clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)",
  },
  {
    key: "hexagon",
    name: "Altıgen",
    clipPath:
      "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)",
  },
  {
    key: "star",
    name: "Yıldız",
    clipPath:
      "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
  },
];

export interface QualityMeasurement {
  id: string;
  spec_id: string;
  job_id: string;
  part_serial: string | null;
  measured_value: number;
  result: QcResult;
  measurement_tool: string | null;
  measured_by: string | null;
  measured_at: string;
  notes: string | null;
  created_at: string;
}

export interface QualitySummary {
  job_id: string;
  job_no: string | null;
  customer: string;
  part_name: string;
  part_no: string | null;
  planned_quantity: number;
  job_status: JobStatus;
  spec_count: number;
  critical_spec_count: number;
  measurement_count: number;
  ok_count: number;
  sinirda_count: number;
  nok_count: number;
  last_measured_at: string | null;
}

export const QC_CHARACTERISTIC_LABEL: Record<QcCharacteristicType, string> = {
  boyut: "Boyut",
  gdt: "Geometrik Tolerans",
  yuzey: "Yüzey",
  sertlik: "Sertlik",
  agirlik: "Ağırlık",
  diger: "Diğer",
};

export const QC_CHARACTERISTIC_EMOJI: Record<QcCharacteristicType, string> = {
  boyut: "📏",
  gdt: "📐",
  yuzey: "✨",
  sertlik: "🪨",
  agirlik: "⚖️",
  diger: "🔖",
};

export const QC_RESULT_LABEL: Record<QcResult, string> = {
  ok: "OK",
  sinirda: "Sınırda",
  nok: "NOK",
};

export const QC_RESULT_TONE: Record<QcResult, string> = {
  ok: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  sinirda: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  nok: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
};

// Common measurement tool presets used in CNC shops
export const QC_TOOL_PRESETS: readonly string[] = [
  "Kumpas",
  "Dijital Kumpas",
  "Mikrometre",
  "Dijital Mikrometre",
  "Mastar",
  "Komparatör",
  "Pasametre",
  "Yükseklik Mastarı",
  "Gönye",
  "CMM",
  "Pürüzlülük Cihazı",
  "Sertlik Cihazı",
];

// Common tolerance presets (ISO 2768 fine/medium and shop-friendly values)
export const QC_TOLERANCE_PRESETS: readonly { label: string; value: number }[] = [
  { label: "±0.005", value: 0.005 },
  { label: "±0.01", value: 0.01 },
  { label: "±0.02", value: 0.02 },
  { label: "±0.05", value: 0.05 },
  { label: "±0.1", value: 0.1 },
  { label: "±0.2", value: 0.2 },
  { label: "±0.5", value: 0.5 },
];

// Evaluate a measured value against a spec.
//   ok       — strictly within (nominal - tolMinus, nominal + tolPlus)
//   sinirda  — within band but consumed >80% of either side (warning)
//   nok      — out of band
export function calculateQcResult(
  measured: number,
  nominal: number,
  tolPlus: number,
  tolMinus: number,
): QcResult {
  const dev = measured - nominal;
  const upper = tolPlus;
  const lower = -tolMinus;
  if (dev > upper || dev < lower) return "nok";
  // Consumed % of the relevant side
  const consumed =
    dev >= 0 ? (upper > 0 ? dev / upper : 0) : lower < 0 ? dev / lower : 0;
  if (consumed >= 0.8) return "sinirda";
  return "ok";
}

export function formatToleranceRange(
  nominal: number,
  tolPlus: number,
  tolMinus: number,
  unit: string,
): string {
  const min = nominal - tolMinus;
  const max = nominal + tolPlus;
  return `${min.toFixed(3)} – ${max.toFixed(3)} ${unit}`;
}

export function formatToleranceBand(tolPlus: number, tolMinus: number): string {
  if (tolPlus === tolMinus) return `±${tolPlus}`;
  return `+${tolPlus} / −${tolMinus}`;
}

// Deviation as % of nominal, signed. Used in measurement bar UX:
//   nominal=12, measured=11.89 → -0.92%
export function deviationPct(measured: number, nominal: number): number {
  if (!nominal) return 0;
  return ((measured - nominal) / nominal) * 100;
}

// ============================================================
// Activity / Audit Feed
// ============================================================
export type ActivityEventType =
  | "job.created" | "job.updated" | "job.deleted" | "job.status_changed" | "job.tools_assigned"
  | "production.created"
  | "spec.created" | "spec.deleted"
  | "measurement.created" | "measurement.nok"
  | "review.created"
  | "tool.created" | "tool.deleted" | "tool.image_set"
  | "operator.created" | "operator.updated" | "operator.deleted"
  | "machine.created" | "machine.status_changed" | "machine.deleted" | "machine.shift_assigned"
  | "drawing.uploaded" | "drawing.deleted" | "drawing.annotated"
  | "order.created" | "order.status_changed" | "order.deleted"
  | "supplier.created"
  | "cad.uploaded" | "cad.deleted"
  | "user.created" | "user.deleted" | "user.role_changed";

export interface ActivityEvent {
  id: string;
  event_type: ActivityEventType;
  actor_id: string | null;
  actor_name: string | null;
  entity_type: string | null;
  entity_id: string | null;
  entity_label: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ============================================================
// Machine Timeline (per-machine social feed)
// ============================================================
export type TimelineEntryKind =
  | "manuel"
  | "bakim"
  | "temizlik"
  | "ariza"
  | "duzeltme"
  | "parca_degisimi"
  | "sayim"
  | "gozlem";

export const TIMELINE_KIND_LABEL: Record<TimelineEntryKind, string> = {
  manuel: "Manuel Not",
  bakim: "Bakım",
  temizlik: "Temizlik",
  ariza: "Arıza",
  duzeltme: "Düzeltme",
  parca_degisimi: "Parça Değişimi",
  sayim: "Sayım",
  gozlem: "Gözlem",
};

export interface MachineTimelineEntry {
  id: string;
  machine_id: string;
  author_id: string | null;
  author_name: string | null;
  kind: TimelineEntryKind;
  title: string | null;
  body: string | null;
  photo_paths: string[];
  duration_minutes: number | null;
  happened_at: string;
  created_at: string;
  updated_at: string;
}

export interface TimelineComment {
  id: string;
  entry_id: string;
  author_id: string | null;
  author_name: string | null;
  body: string;
  created_at: string;
}

export interface TimelineReaction {
  id: string;
  entry_id: string;
  author_id: string;
  kind: "like" | "dislike";
  created_at: string;
}

// Public storage URL for a timeline photo path.
export function timelinePhotoUrl(path: string): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/timeline-photos/${path}`;
}

// ============================================================
// Quality Reviews (sign-off trail)
// ============================================================
export type QcReviewerRole = "operator" | "kontrolor" | "onaylayan";
export type QcReviewStatus = "onaylandi" | "reddedildi" | "koşullu";

export interface QualityReview {
  id: string;
  job_id: string;
  reviewer_id: string;
  reviewer_role: QcReviewerRole;
  status: QcReviewStatus;
  notes: string | null;
  reviewed_at: string;
  created_at: string;
}

export const QC_REVIEWER_ROLE_LABEL: Record<QcReviewerRole, string> = {
  operator: "Operatör",
  kontrolor: "Kontrolör",
  onaylayan: "Onaylayan",
};

export const QC_REVIEW_STATUS_LABEL: Record<QcReviewStatus, string> = {
  onaylandi: "Onaylandı",
  reddedildi: "Reddedildi",
  "koşullu": "Şartlı Kabul",
};

export const QC_REVIEW_STATUS_TONE: Record<QcReviewStatus, string> = {
  onaylandi:
    "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  reddedildi: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
  "koşullu":
    "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
};

// ============================================================
// CAD/CAM Programs
// ============================================================
export interface CadProgram {
  id: string;
  title: string;
  machine_id: string | null;
  job_id: string | null;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  revision: string | null;
  notes: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

// Recognised file kinds — drives icon + label in lists.
export type CadFileKind = "gcode" | "cad" | "pdf" | "doc" | "other";

export function detectCadFileKind(
  fileType: string | null,
  filePath: string,
): CadFileKind {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  if (["nc", "tap", "gcode", "ngc", "iso", "eia", "cnc", "mpf"].includes(ext)) {
    return "gcode";
  }
  if (
    ["step", "stp", "stl", "iges", "igs", "dxf", "dwg", "x_t", "sldprt"].includes(
      ext,
    )
  ) {
    return "cad";
  }
  if (ext === "pdf" || fileType === "application/pdf") return "pdf";
  if (
    ["txt", "log", "doc", "docx", "rtf"].includes(ext) ||
    fileType?.startsWith("text/")
  ) {
    return "doc";
  }
  return "other";
}

export const CAD_FILE_KIND_LABEL: Record<CadFileKind, string> = {
  gcode: "G-Code / NC",
  cad: "CAD Modeli",
  pdf: "PDF",
  doc: "Doküman",
  other: "Dosya",
};

// Common CNC/CAD extensions to advertise in the file picker.
export const CAD_ACCEPT_EXTENSIONS =
  ".nc,.tap,.gcode,.ngc,.iso,.eia,.cnc,.mpf,.step,.stp,.stl,.iges,.igs,.dxf,.dwg,.x_t,.sldprt,.pdf,.txt,.log";

// ── Messaging ──────────────────────────────────────────────────────
export type ConversationKind = "direct" | "group";

export interface Conversation {
  id: string;
  kind: ConversationKind;
  title: string | null;
  color: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
  last_message_preview: string | null;
}

export interface ConversationParticipant {
  conversation_id: string;
  user_id: string;
  role: "admin" | "member";
  joined_at: string;
  last_read_at: string | null;
  archived_at: string | null;
  pinned_at: string | null;
  tags: string[];
  /** Format: "pattern:<key>#<hex>" or "#<hex>" or null. */
  wallpaper: string | null;
}

// Chat wallpaper presets — pattern key + readable name. The actual CSS
// gradient/background-image lives in the renderer (chat-panel.tsx) so
// types stay framework-agnostic.
export type ChatWallpaperPattern =
  | "none"
  | "dots"
  | "grid"
  | "diagonal"
  | "hex"
  | "plus"
  | "waves";

export const CHAT_WALLPAPER_PATTERNS: ReadonlyArray<{
  key: ChatWallpaperPattern;
  name: string;
}> = [
  { key: "none", name: "Düz" },
  { key: "dots", name: "Noktalar" },
  { key: "grid", name: "Izgara" },
  { key: "diagonal", name: "Çizgi" },
  { key: "hex", name: "Petek" },
  { key: "plus", name: "Artı" },
  { key: "waves", name: "Dalga" },
];

// 8 + auto color choices for the wallpaper accent color.
export const CHAT_WALLPAPER_COLORS: ReadonlyArray<{
  hex: string;
  name: string;
}> = [
  { hex: "#f8fafc", name: "Beyaz" },
  { hex: "#0f172a", name: "Lacivert" },
  { hex: "#1e293b", name: "Slate" },
  { hex: "#0c4a6e", name: "Deniz" },
  { hex: "#064e3b", name: "Orman" },
  { hex: "#3b0764", name: "Mor" },
  { hex: "#7c2d12", name: "Kahve" },
  { hex: "#831843", name: "Bordo" },
];

export interface ParsedWallpaper {
  pattern: ChatWallpaperPattern;
  color: string;
}

export function parseWallpaper(input: string | null | undefined): ParsedWallpaper {
  // Accepts:
  //  - null / "" → default (none + theme bg)
  //  - "#rrggbb"   → solid color, no pattern
  //  - "pattern:dots#ff8800" → pattern + accent
  if (!input) return { pattern: "none", color: "" };
  const m = input.match(/^pattern:([a-z]+)(#[0-9a-fA-F]{6})$/);
  if (m) {
    const [, p, c] = m;
    const known = CHAT_WALLPAPER_PATTERNS.some((x) => x.key === p);
    return {
      pattern: known ? (p as ChatWallpaperPattern) : "none",
      color: c,
    };
  }
  if (/^#[0-9a-fA-F]{6}$/.test(input)) return { pattern: "none", color: input };
  return { pattern: "none", color: "" };
}

export function formatWallpaper(p: ChatWallpaperPattern, color: string): string {
  if (p === "none") return color;
  return `pattern:${p}${color}`;
}

// ── Calendar ────────────────────────────────────────────────────────
export type CalendarEventColor =
  | "blue"
  | "cyan"
  | "green"
  | "amber"
  | "orange"
  | "red"
  | "pink"
  | "violet"
  | "gray";

export type CalendarAttendeeStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "tentative";

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  color: CalendarEventColor;
  job_id: string | null;
  machine_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CalendarEventAttendee {
  event_id: string;
  user_id: string;
  status: CalendarAttendeeStatus;
  responded_at: string | null;
}

export const CALENDAR_COLOR_MAP: Record<
  CalendarEventColor,
  { bg: string; bgSoft: string; border: string; dot: string; name: string }
> = {
  blue:   { bg: "bg-blue-500",   bgSoft: "bg-blue-500/15",   border: "border-blue-500",   dot: "bg-blue-500",   name: "Mavi" },
  cyan:   { bg: "bg-cyan-500",   bgSoft: "bg-cyan-500/15",   border: "border-cyan-500",   dot: "bg-cyan-500",   name: "Cyan" },
  green:  { bg: "bg-emerald-500",bgSoft: "bg-emerald-500/15",border: "border-emerald-500",dot: "bg-emerald-500",name: "Yeşil" },
  amber:  { bg: "bg-amber-500",  bgSoft: "bg-amber-500/15",  border: "border-amber-500",  dot: "bg-amber-500",  name: "Sarı" },
  orange: { bg: "bg-orange-500", bgSoft: "bg-orange-500/15", border: "border-orange-500", dot: "bg-orange-500", name: "Turuncu" },
  red:    { bg: "bg-red-500",    bgSoft: "bg-red-500/15",    border: "border-red-500",    dot: "bg-red-500",    name: "Kırmızı" },
  pink:   { bg: "bg-pink-500",   bgSoft: "bg-pink-500/15",   border: "border-pink-500",   dot: "bg-pink-500",   name: "Pembe" },
  violet: { bg: "bg-violet-500", bgSoft: "bg-violet-500/15", border: "border-violet-500", dot: "bg-violet-500", name: "Mor" },
  gray:   { bg: "bg-zinc-500",   bgSoft: "bg-zinc-500/15",   border: "border-zinc-500",   dot: "bg-zinc-500",   name: "Gri" },
};

export const CALENDAR_ATTENDEE_LABEL: Record<CalendarAttendeeStatus, string> = {
  pending: "Yanıt Bekleniyor",
  accepted: "Katılıyor",
  declined: "Katılmıyor",
  tentative: "Belki",
};

// Predefined Outlook-style label palette (key + bg/text classes + name)
export const CONVERSATION_TAG_PRESETS: ReadonlyArray<{
  key: string;
  name: string;
  bg: string;
  text: string;
  dot: string;
}> = [
  { key: "onemli", name: "Önemli", bg: "bg-red-500/15", text: "text-red-700 dark:text-red-300", dot: "bg-red-500" },
  { key: "is", name: "İş", bg: "bg-blue-500/15", text: "text-blue-700 dark:text-blue-300", dot: "bg-blue-500" },
  { key: "kisisel", name: "Kişisel", bg: "bg-violet-500/15", text: "text-violet-700 dark:text-violet-300", dot: "bg-violet-500" },
  { key: "acil", name: "Acil", bg: "bg-orange-500/15", text: "text-orange-700 dark:text-orange-300", dot: "bg-orange-500" },
  { key: "musteri", name: "Müşteri", bg: "bg-emerald-500/15", text: "text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  { key: "tedarikci", name: "Tedarikçi", bg: "bg-amber-500/15", text: "text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
  { key: "takip", name: "Takip", bg: "bg-cyan-500/15", text: "text-cyan-700 dark:text-cyan-300", dot: "bg-cyan-500" },
  { key: "arsiv", name: "Arşiv", bg: "bg-zinc-500/15", text: "text-zinc-700 dark:text-zinc-300", dot: "bg-zinc-500" },
];

export function tagMeta(key: string) {
  return (
    CONVERSATION_TAG_PRESETS.find((t) => t.key === key) ?? {
      key,
      name: key,
      bg: "bg-muted",
      text: "text-foreground",
      dot: "bg-zinc-500",
    }
  );
}

export interface Message {
  id: string;
  conversation_id: string;
  author_id: string | null;
  body: string | null;
  reply_to: string | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
}

export interface MessageAttachment {
  id: string;
  message_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

// Convenience type for message lists rendered in the UI — joins author profile
// and any attachments.
export interface MessageWithRelations extends Message {
  author?: {
    id: string;
    full_name: string | null;
    phone: string | null;
  } | null;
  attachments?: MessageAttachment[];
}

// Curated palette for conversation accent colors.
export const CONVERSATION_COLOR_PRESETS: ReadonlyArray<{
  hex: string;
  name: string;
}> = [
  { hex: "#3b82f6", name: "Mavi" },
  { hex: "#06b6d4", name: "Cyan" },
  { hex: "#10b981", name: "Yeşil" },
  { hex: "#84cc16", name: "Limon" },
  { hex: "#f59e0b", name: "Sarı" },
  { hex: "#f97316", name: "Turuncu" },
  { hex: "#ef4444", name: "Kırmızı" },
  { hex: "#ec4899", name: "Pembe" },
  { hex: "#8b5cf6", name: "Mor" },
  { hex: "#6366f1", name: "İndigo" },
  { hex: "#1f2937", name: "Siyah" },
];

export function readableTextOn(hex: string | null | undefined): string {
  // Pick black or white text based on the perceived luminance of the bg.
  if (!hex) return "white";
  const m = hex.replace("#", "");
  if (m.length !== 6) return "white";
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#0f172a" : "white";
}
