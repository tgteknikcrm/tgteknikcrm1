export type UserRole = "admin" | "operator";
export type MachineType = "Fanuc" | "Tekna" | "BWX" | "Diger";
export type MachineStatus = "aktif" | "durus" | "bakim" | "ariza";
export type Shift = "sabah" | "aksam" | "gece";
export type JobStatus =
  | "beklemede"
  | "ayar"
  | "uretimde"
  | "tamamlandi"
  | "iptal";
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
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

// Online: a user pinged within the last 60 seconds. Returns a tuple
// `[online, label]` where label is "şu an online", "5 dk önce", etc.
export function presenceLabel(
  lastSeenAt: string | null | undefined,
): [online: boolean, label: string] {
  if (!lastSeenAt) return [false, "uzun süredir görünmedi"];
  const t = new Date(lastSeenAt).getTime();
  const diff = Date.now() - t;
  if (diff < 60_000) return [true, "şu an online"];
  if (diff < 60 * 60_000)
    return [false, `${Math.floor(diff / 60_000)} dk önce`];
  if (diff < 24 * 60 * 60_000)
    return [false, `${Math.floor(diff / 3_600_000)} sa önce`];
  if (diff < 7 * 24 * 60 * 60_000)
    return [false, `${Math.floor(diff / 86_400_000)} gün önce`];
  return [false, new Date(lastSeenAt).toLocaleDateString("tr-TR")];
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
  // Linked product (migration 0025)
  product_id?: string | null;
  // Step timing (migration 0028)
  started_at?: string | null;
  setup_completed_at?: string | null;
}

// Step indicator: index 0..3 (Beklemede / Ayar / Üretimde / Tamamlandı)
// for the 4-step progress on the Jobs page. Cancelled jobs return null
// (rendered as a single grey "İptal" pill instead of a stepper).
export const JOB_STEPS: Array<{ key: JobStatus; label: string }> = [
  { key: "beklemede", label: "Beklemede" },
  { key: "ayar", label: "Ayar" },
  { key: "uretimde", label: "Üretimde" },
  { key: "tamamlandi", label: "Tamamlandı" },
];

export function jobStepIndex(status: JobStatus): number {
  switch (status) {
    case "beklemede":
      return 0;
    case "ayar":
      return 1;
    case "uretimde":
      return 2;
    case "tamamlandi":
      return 3;
    default:
      return -1;
  }
}

/**
 * Job timeline math — drives the "X parça, ~Y saat" estimates on the
 * Jobs page card. Pure function so we can reuse it from the detail
 * page later without an extra round trip.
 */
export function calcJobTimeline(input: {
  quantity: number;
  produced: number;
  cycleMinutes: number | null | undefined;
  cleanupMinutes?: number | null | undefined;
  setupMinutes: number | null | undefined;
  partsPerSetup: number | null | undefined;
}): {
  remaining: number;
  setupsLeft: number;
  effectiveCycle: number;
  remainingSetupMinutes: number;
  remainingProductionMinutes: number;
  remainingTotalMinutes: number;
  totalSetupMinutes: number;
  totalProductionMinutes: number;
  totalMinutes: number;
  progressPct: number; // 0–100
} {
  const quantity = Math.max(0, input.quantity ?? 0);
  const produced = Math.max(0, Math.min(input.produced ?? 0, quantity));
  const cycle = Math.max(0, input.cycleMinutes ?? 0);
  const cleanup = Math.max(0, input.cleanupMinutes ?? 0);
  const setup = Math.max(0, input.setupMinutes ?? 0);
  const pps =
    input.partsPerSetup && input.partsPerSetup > 0 ? input.partsPerSetup : 1;

  // Effective cycle includes operator cleanup/swap per piece.
  const effectiveCycle = cycle + cleanup;

  const remaining = Math.max(0, quantity - produced);
  const setupsLeft = remaining > 0 ? Math.ceil(remaining / pps) : 0;
  const totalSetups = quantity > 0 ? Math.ceil(quantity / pps) : 0;

  const remainingSetupMinutes = setupsLeft * setup;
  const remainingProductionMinutes = remaining * effectiveCycle;
  const remainingTotalMinutes =
    remainingSetupMinutes + remainingProductionMinutes;

  const totalSetupMinutes = totalSetups * setup;
  const totalProductionMinutes = quantity * effectiveCycle;
  const totalMinutes = totalSetupMinutes + totalProductionMinutes;

  const progressPct = quantity > 0 ? (produced / quantity) * 100 : 0;

  return {
    remaining,
    setupsLeft,
    effectiveCycle,
    remainingSetupMinutes,
    remainingProductionMinutes,
    remainingTotalMinutes,
    totalSetupMinutes,
    totalProductionMinutes,
    totalMinutes,
    progressPct,
  };
}

/**
 * Live "kaç parça üretildi şimdiye kadar" estimate.
 *
 * Source of truth for already-produced is production_entries — but
 * those entries only get bumped at the end of the run (Tamamla) or
 * via the auto-downtime trigger. Between those events the operator
 * wants a number that ticks up in real time.
 *
 * Math:
 *   elapsedMin = (clock - setup_completed_at) / 60
 *   - subtract creditedDowntimeMin (already on the entry)
 *   - if a downtime session is OPEN now, freeze elapsed at the
 *     moment the session started so we don't keep "producing" while
 *     the machine is in arıza/bakım/durus.
 *   pieces = floor(effective / (cycle + cleanup))
 *
 * Capped at quantity. Returns liveActive=false when the machine is
 * stopped so the UI can render a "DURDU" pill instead of the green
 * pulse.
 */
export function calcLiveProduced(input: {
  setupCompletedAt: string | null | undefined;
  jobStatus: JobStatus;
  machineStatus?: MachineStatus | null;
  cycleMinutes: number | null | undefined;
  cleanupMinutes: number | null | undefined;
  alreadyProduced: number;
  quantity: number;
  /**
   * Downtime minutes already credited to today's production_entry
   * (closed sessions). The trigger writes this on session close;
   * we subtract it from elapsed.
   */
  creditedDowntimeMinutes?: number;
  /**
   * If a downtime session is currently OPEN for this machine, the
   * timestamp it started at. We freeze elapsed at this instant so
   * the live ticker stops while the machine is down — even before
   * the trigger has had a chance to credit the closed session.
   */
  openDowntimeStartedAt?: string | null | undefined;
  now?: Date;
}): {
  liveProduced: number;
  pieceProgressPct: number; // 0..100 toward the next piece
  effectiveCycleMin: number;
  liveActive: boolean;
  stoppedReason: MachineStatus | null;
  /** True when liveProduced has hit the requested quantity. Drives
   *  the auto-completion countdown on the JobCard. */
  reachedTarget: boolean;
} {
  const cycle = Math.max(0, input.cycleMinutes ?? 0);
  const cleanup = Math.max(0, input.cleanupMinutes ?? 0);
  const effectiveCycleMin = cycle + cleanup;
  const remaining = Math.max(
    0,
    input.quantity - Math.max(0, input.alreadyProduced),
  );
  const isMachineDown =
    input.machineStatus != null && input.machineStatus !== "aktif";
  const stoppedReason = isMachineDown
    ? (input.machineStatus as MachineStatus)
    : null;

  const baseEligible =
    input.jobStatus === "uretimde" &&
    !!input.setupCompletedAt &&
    effectiveCycleMin > 0;

  if (!baseEligible) {
    return {
      liveProduced: input.alreadyProduced,
      pieceProgressPct: 0,
      effectiveCycleMin,
      liveActive: false,
      stoppedReason,
      reachedTarget: false,
    };
  }

  const now = input.now ?? new Date();
  // Anchor the "current" timestamp at the moment downtime started, so
  // the live ticker freezes the second the operator flips the machine
  // away from aktif (no need to wait for the page to refresh).
  const ceilingMs =
    isMachineDown && input.openDowntimeStartedAt
      ? Math.min(
          now.getTime(),
          new Date(input.openDowntimeStartedAt).getTime(),
        )
      : now.getTime();

  const grossElapsedMin = Math.max(
    0,
    (ceilingMs - new Date(input.setupCompletedAt!).getTime()) / 60_000,
  );
  const credited = Math.max(0, input.creditedDowntimeMinutes ?? 0);
  const effectiveMin = Math.max(0, grossElapsedMin - credited);

  const wholePieces = Math.floor(effectiveMin / effectiveCycleMin);
  const remainderMin = effectiveMin - wholePieces * effectiveCycleMin;
  const cappedPieces = Math.min(wholePieces, remaining);
  const liveProduced = input.alreadyProduced + cappedPieces;
  const reachedTarget = cappedPieces >= remaining; // hit quantity
  // Once we've hit the target piece count, freeze the per-piece progress
  // bar at 100% — there's no "next piece" anymore. Otherwise show the
  // partial progress toward the next cycle.
  const pieceProgressPct = reachedTarget
    ? 100
    : Math.min(100, (remainderMin / effectiveCycleMin) * 100);

  return {
    liveProduced,
    pieceProgressPct: isMachineDown ? 0 : pieceProgressPct,
    effectiveCycleMin,
    // liveActive = true while we're still ticking forward. Once the
    // target piece count is reached the machine is "done waiting" —
    // surface that to the UI so it can fire auto-completion.
    liveActive: !isMachineDown && remaining > 0 && !reachedTarget,
    stoppedReason,
    reachedTarget,
  };
}

/** Friendly "2 sa 30 dk" / "45 dk" / "1 g 4 sa" formatter. */
export function formatMinutes(mins: number): string {
  if (!mins || mins <= 0) return "0 dk";
  const total = Math.round(mins);
  const days = Math.floor(total / (60 * 24));
  const hours = Math.floor((total % (60 * 24)) / 60);
  const minutes = total % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} g`);
  if (hours > 0) parts.push(`${hours} sa`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes} dk`);
  return parts.join(" ");
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
  setup_minutes: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ── Work schedule (app_settings 'work_schedule') ──────────────────
//
// 7 days (1=Mon .. 7=Sun, ISO style). Each day has its own toggle
// and durations so Saturdays can be 8 saat ile mesai, Sundays kapalı,
// etc. Used by the calendar-aware ETA helper.
export interface WorkScheduleDay {
  day: number; // 1=Pzt .. 7=Pzr
  enabled: boolean;
  shift_start: string; // "HH:MM"
  work_minutes: number; // net (lunch hariç)
  lunch_minutes: number;
}

export interface WorkSchedule {
  days: WorkScheduleDay[];
}

export const DEFAULT_WORK_SCHEDULE: WorkSchedule = {
  days: [
    { day: 1, enabled: true,  shift_start: "08:00", work_minutes: 540, lunch_minutes: 60 },
    { day: 2, enabled: true,  shift_start: "08:00", work_minutes: 540, lunch_minutes: 60 },
    { day: 3, enabled: true,  shift_start: "08:00", work_minutes: 540, lunch_minutes: 60 },
    { day: 4, enabled: true,  shift_start: "08:00", work_minutes: 540, lunch_minutes: 60 },
    { day: 5, enabled: true,  shift_start: "08:00", work_minutes: 540, lunch_minutes: 60 },
    { day: 6, enabled: false, shift_start: "08:00", work_minutes: 480, lunch_minutes: 60 },
    { day: 7, enabled: false, shift_start: "08:00", work_minutes: 480, lunch_minutes: 60 },
  ],
};

export const DAY_LABELS_TR: Record<number, string> = {
  1: "Pazartesi",
  2: "Salı",
  3: "Çarşamba",
  4: "Perşembe",
  5: "Cuma",
  6: "Cumartesi",
  7: "Pazar",
};

export const DAY_LABELS_TR_SHORT: Record<number, string> = {
  1: "Pzt",
  2: "Sal",
  3: "Çar",
  4: "Per",
  5: "Cum",
  6: "Cmt",
  7: "Pzr",
};

/**
 * ISO weekday (1=Mon .. 7=Sun) of the given Date in the local TZ.
 * JS Date.getDay() returns 0=Sun .. 6=Sat → remap.
 */
export function isoDayOfWeek(d: Date): number {
  const js = d.getDay(); // 0..6
  return js === 0 ? 7 : js;
}

function parseHHMM(s: string): { h: number; m: number } {
  const [h, m] = s.split(":").map(Number);
  return { h: h || 0, m: m || 0 };
}

/**
 * Calendar-aware ETA: given remaining work minutes and a starting
 * wall-clock, walk forward day by day, honouring the schedule's
 * enabled flags and per-day work_minutes (already lunch-excluded),
 * and return the moment those minutes are exhausted.
 *
 * Today's contribution: if `from` is mid-shift, we use the minutes
 * remaining until shift_end (work_minutes after shift_start).
 * Lunch break is treated as a single block at the middle of the
 * day for "is now in lunch?" purposes — close enough for ETA UX.
 */
export function calcEtaCalendarAware(
  remainingMinutes: number,
  schedule: WorkSchedule,
  from: Date = new Date(),
): Date {
  if (remainingMinutes <= 0) return new Date(from);

  const dayByIso = new Map(schedule.days.map((d) => [d.day, d]));

  let cursor = new Date(from);
  let left = remainingMinutes;
  // Hard ceiling: don't loop forever if every day is disabled.
  for (let step = 0; step < 365; step++) {
    const dayCfg = dayByIso.get(isoDayOfWeek(cursor));
    if (!dayCfg || !dayCfg.enabled) {
      // Skip to next day, 00:00.
      cursor = new Date(
        cursor.getFullYear(),
        cursor.getMonth(),
        cursor.getDate() + 1,
      );
      continue;
    }

    const { h, m } = parseHHMM(dayCfg.shift_start);
    const shiftStart = new Date(
      cursor.getFullYear(),
      cursor.getMonth(),
      cursor.getDate(),
      h,
      m,
      0,
      0,
    );
    // Shift end = start + work_minutes + lunch_minutes (wall clock).
    const shiftEnd = new Date(
      shiftStart.getTime() +
        (dayCfg.work_minutes + dayCfg.lunch_minutes) * 60_000,
    );

    // If the cursor is after shift end, jump to next day.
    if (cursor.getTime() >= shiftEnd.getTime()) {
      cursor = new Date(
        cursor.getFullYear(),
        cursor.getMonth(),
        cursor.getDate() + 1,
      );
      continue;
    }

    // If the cursor is before shift start, jump to shift start.
    if (cursor.getTime() < shiftStart.getTime()) {
      cursor = new Date(shiftStart);
    }

    // Available work minutes from cursor to shift end. Approximate by
    // mapping wall-clock distance × work/(work+lunch) ratio so the
    // lunch hour proportionally consumes wall-clock.
    const wallMinutes = (shiftEnd.getTime() - cursor.getTime()) / 60_000;
    const availableNet = Math.max(
      0,
      Math.floor(
        (wallMinutes * dayCfg.work_minutes) /
          (dayCfg.work_minutes + dayCfg.lunch_minutes),
      ),
    );

    if (left <= availableNet) {
      // Finishes today. Convert net-minutes back to wall-minutes.
      const wallNeeded =
        (left * (dayCfg.work_minutes + dayCfg.lunch_minutes)) /
        dayCfg.work_minutes;
      return new Date(cursor.getTime() + wallNeeded * 60_000);
    }

    // Use the rest of today, then continue tomorrow.
    left -= availableNet;
    cursor = new Date(
      cursor.getFullYear(),
      cursor.getMonth(),
      cursor.getDate() + 1,
    );
  }
  // Schedule is empty — fall back to "right now".
  return new Date(from);
}

export interface Drawing {
  id: string;
  job_id: string | null;
  product_id: string | null;
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
  ayar: "Ayar Yapılıyor",
  uretimde: "Üretimde",
  tamamlandi: "Tamamlandı",
  iptal: "İptal",
};

// Tone classes for the 4-step indicator on the Jobs page (and other
// JobStatus badges). Each step gets a distinct accent.
export const JOB_STATUS_TONE: Record<
  JobStatus,
  { bg: string; text: string; dot: string; ring: string }
> = {
  beklemede: {
    bg: "bg-zinc-500/10",
    text: "text-zinc-700 dark:text-zinc-300",
    dot: "bg-zinc-500",
    ring: "ring-zinc-500/40",
  },
  ayar: {
    bg: "bg-amber-500/15",
    text: "text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
    ring: "ring-amber-500/40",
  },
  uretimde: {
    bg: "bg-emerald-500/15",
    text: "text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
    ring: "ring-emerald-500/40",
  },
  tamamlandi: {
    bg: "bg-blue-500/15",
    text: "text-blue-700 dark:text-blue-300",
    dot: "bg-blue-500",
    ring: "ring-blue-500/40",
  },
  iptal: {
    bg: "bg-rose-500/15",
    text: "text-rose-700 dark:text-rose-300",
    dot: "bg-rose-500",
    ring: "ring-rose-500/40",
  },
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
  product_id: string | null;
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

// ── Products (master) ──────────────────────────────────────────────
export type ProductStatus = "aktif" | "taslak" | "pasif";
export type ProductProcess =
  | "tornalama"
  | "frezeleme"
  | "tornalama_frezeleme"
  | "taslama"
  | "erozyon"
  | "lazer"
  | "diger";
export type ProductCurrency = "TRY" | "USD" | "EUR";

export const PRODUCT_STATUS_LABEL: Record<ProductStatus, string> = {
  aktif: "Aktif",
  taslak: "Taslak",
  pasif: "Pasif",
};

export const PRODUCT_PROCESS_LABEL: Record<ProductProcess, string> = {
  tornalama: "Tornalama",
  frezeleme: "Frezeleme",
  tornalama_frezeleme: "Tornalama + Frezeleme",
  taslama: "Taşlama",
  erozyon: "Erozyon",
  lazer: "Lazer",
  diger: "Diğer",
};

export const PRODUCT_STATUS_TONE: Record<ProductStatus, string> = {
  aktif: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  taslak: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  pasif: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30",
};

// Material / surface / heat treatment presets — free-form text in DB,
// these just power the autocomplete dropdown in the form.
export const MATERIAL_PRESETS = [
  "Çelik (St37)",
  "Çelik (1040)",
  "Çelik (4140)",
  "Paslanmaz (304)",
  "Paslanmaz (316)",
  "Alüminyum (6061)",
  "Alüminyum (7075)",
  "Pirinç",
  "Bakır",
  "Bronz",
  "Plastik (POM)",
  "Plastik (PA6)",
];

export const SURFACE_TREATMENT_PRESETS = [
  "Hiçbiri",
  "Eloksal (siyah)",
  "Eloksal (renkli)",
  "Krom kaplama",
  "Çinko kaplama",
  "Nikel kaplama",
  "Pasivasyon",
  "Boyalı",
  "Kumlama",
  "Polisaj",
];

export const HEAT_TREATMENT_PRESETS = [
  "Hiçbiri",
  "Sertleştirme",
  "Tavlama",
  "Normalleştirme",
  "Su verme + Temperleme",
  "Sementasyon",
  "Nitrasyon",
];

export const TOLERANCE_CLASS_PRESETS = [
  "ISO 2768-fH (Hassas)",
  "ISO 2768-mK (Orta)",
  "ISO 2768-cL (Kaba)",
  "DIN 7168 ince",
  "DIN 7168 orta",
];

export const PRODUCT_CATEGORY_PRESETS = [
  "Mil",
  "Flanş",
  "Kovan",
  "Kalıp Parçası",
  "Bağlama Parçası",
  "Yatak",
  "Dişli",
  "Profil",
  "Pim",
  "Cıvata/Somun",
  "Aparat",
  "Yedek Parça",
  "Diğer",
];

export interface Product {
  id: string;
  code: string;
  name: string;
  description: string | null;
  customer: string | null;
  default_quantity: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Extended (migration 0027)
  category: string | null;
  material: string | null;
  surface_treatment: string | null;
  heat_treatment: string | null;
  weight_kg: number | null;
  length_mm: number | null;
  width_mm: number | null;
  height_mm: number | null;
  diameter_mm: number | null;
  tolerance_class: string | null;
  surface_finish_ra: number | null;
  hardness: string | null;
  process_type: ProductProcess | null;
  cycle_time_minutes: number | null;
  cleanup_time_minutes: number | null;
  setup_time_minutes: number | null;
  parts_per_setup: number | null;
  default_machine_id: string | null;
  min_order_qty: number | null;
  unit_price: number | null;
  currency: ProductCurrency | null;
  customer_part_no: string | null;
  customer_drawing_ref: string | null;
  status: ProductStatus;
  revision: string | null;
  revision_date: string | null;
  tags: string[];
}

export interface ProductTool {
  product_id: string;
  tool_id: string;
  quantity_used: number;
  notes: string | null;
}

export interface ProductImage {
  id: string;
  product_id: string;
  image_path: string;
  caption: string | null;
  sort_order: number;
  is_primary: boolean;
  uploaded_by: string | null;
  created_at: string;
}

// Public storage URL for a product image. Bucket 'product-images' is
// public, mirror of toolImagePublicUrl() for consistency.
export function productImagePublicUrl(
  path: string | null | undefined,
): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/product-images/${path}`;
}

// ── Tasks ───────────────────────────────────────────────────────────
export type TaskStatus = "todo" | "in_progress" | "done" | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  assigned_to: string | null;
  job_id: string | null;
  machine_id: string | null;
  tags: string[];
  created_by: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskChecklistItem {
  id: string;
  task_id: string;
  body: string;
  done: boolean;
  position: number;
  created_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
}

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "Yapılacak",
  in_progress: "Devam Ediyor",
  done: "Tamamlandı",
  cancelled: "İptal",
};

export const TASK_STATUS_TONE: Record<
  TaskStatus,
  { bg: string; text: string; dot: string; border: string }
> = {
  todo: {
    bg: "bg-zinc-500/10",
    text: "text-zinc-700 dark:text-zinc-300",
    dot: "bg-zinc-500",
    border: "border-zinc-500/30",
  },
  in_progress: {
    bg: "bg-blue-500/10",
    text: "text-blue-700 dark:text-blue-300",
    dot: "bg-blue-500",
    border: "border-blue-500/30",
  },
  done: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
    border: "border-emerald-500/30",
  },
  cancelled: {
    bg: "bg-rose-500/10",
    text: "text-rose-700 dark:text-rose-300",
    dot: "bg-rose-500",
    border: "border-rose-500/30",
  },
};

export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "Düşük",
  medium: "Orta",
  high: "Yüksek",
  urgent: "Acil",
};

export const TASK_PRIORITY_TONE: Record<
  TaskPriority,
  { bg: string; text: string; ring: string }
> = {
  low: {
    bg: "bg-zinc-500/15",
    text: "text-zinc-700 dark:text-zinc-300",
    ring: "ring-zinc-500/40",
  },
  medium: {
    bg: "bg-amber-500/15",
    text: "text-amber-700 dark:text-amber-300",
    ring: "ring-amber-500/40",
  },
  high: {
    bg: "bg-orange-500/15",
    text: "text-orange-700 dark:text-orange-300",
    ring: "ring-orange-500/40",
  },
  urgent: {
    bg: "bg-red-500/15",
    text: "text-red-700 dark:text-red-300",
    ring: "ring-red-500/40",
  },
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
  /** Where the binary lives — `supabase` (storage bucket via /api/attach)
   *  or `r2` (Cloudflare R2 via the worker/CDN public URL). */
  provider: "supabase" | "r2";
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
