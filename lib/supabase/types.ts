export type UserRole = "admin" | "operator";
export type MachineType = "Fanuc" | "Tekna" | "BWX" | "Diger";
export type MachineStatus = "aktif" | "durus" | "bakim" | "ariza";
export type Shift = "sabah" | "aksam" | "gece";
export type JobStatus = "beklemede" | "uretimde" | "tamamlandi" | "iptal";
export type ToolCondition = "yeni" | "iyi" | "kullanilabilir" | "degistirilmeli";

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
  created_at: string;
  updated_at: string;
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
  created_at: string;
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
