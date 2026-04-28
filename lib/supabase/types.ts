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
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

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
