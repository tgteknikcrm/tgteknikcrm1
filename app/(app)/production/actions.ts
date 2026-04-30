"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getCurrentShift, type Shift } from "@/lib/supabase/types";

function turkeyTodayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Find or create today's open production entry for (machine, shift,
 * job). UPSERT-friendly: relies on the partial unique index
 * production_entries_one_per_machine_date_shift_job (job_id NOT NULL).
 *
 * Returns the row id either way so the caller can append qty/scrap.
 */
async function ensureTodayOpenEntry(args: {
  machine_id: string;
  job_id: string;
  operator_id?: string | null;
  shift?: Shift;
  start_time?: string | null;
}): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const today = turkeyTodayISO();
  const shift = args.shift ?? getCurrentShift();

  const { data: existing } = await supabase
    .from("production_entries")
    .select("id, end_time")
    .eq("machine_id", args.machine_id)
    .eq("entry_date", today)
    .eq("shift", shift)
    .eq("job_id", args.job_id)
    .maybeSingle();

  if (existing) {
    // Re-open if it was closed previously today.
    if (existing.end_time) {
      await supabase
        .from("production_entries")
        .update({ end_time: null })
        .eq("id", existing.id);
    }
    return { id: existing.id };
  }

  const nowHHMM = new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());

  const { data, error } = await supabase
    .from("production_entries")
    .insert({
      entry_date: today,
      shift,
      machine_id: args.machine_id,
      operator_id: args.operator_id ?? null,
      job_id: args.job_id,
      start_time: args.start_time ?? nowHHMM,
      end_time: null,
      produced_qty: 0,
      scrap_qty: 0,
      downtime_minutes: 0,
      setup_minutes: 0,
      notes: null,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (error || !data) {
    return { error: error?.message ?? "Üretim kaydı oluşturulamadı" };
  }
  return { id: data.id };
}

/**
 * Public: open today's entry for a job. Used by the "Ayara Başla"
 * button on the JobCard so the daily form materializes the moment
 * work begins, not at the end of the shift.
 */
export async function openTodayEntryForJob(args: {
  machine_id: string;
  job_id: string;
  operator_id?: string | null;
  shift?: Shift;
}) {
  const r = await ensureTodayOpenEntry(args);
  if ("error" in r) return r;
  revalidatePath("/production");
  revalidatePath("/jobs");
  return { success: true, id: r.id };
}

/**
 * Append produced/scrap/downtime/setup to today's entry (creating if
 * needed). Inline use from the JobCard "+ Üretim" modal.
 */
export async function appendProduction(args: {
  machine_id: string;
  job_id: string;
  operator_id?: string | null;
  produced?: number;
  scrap?: number;
  downtime_minutes?: number;
  setup_minutes?: number;
}) {
  if (!args.machine_id) return { error: "Makine zorunlu" };
  if (!args.job_id) return { error: "İş zorunlu" };
  const supabase = await createClient();
  const ensured = await ensureTodayOpenEntry({
    machine_id: args.machine_id,
    job_id: args.job_id,
    operator_id: args.operator_id ?? null,
  });
  if ("error" in ensured) return ensured;

  const { data: cur, error: fErr } = await supabase
    .from("production_entries")
    .select("produced_qty, scrap_qty, downtime_minutes, setup_minutes")
    .eq("id", ensured.id)
    .single();
  if (fErr || !cur) return { error: fErr?.message ?? "Kayıt okunamadı" };

  const next = {
    produced_qty: (cur.produced_qty ?? 0) + Math.max(0, args.produced ?? 0),
    scrap_qty: (cur.scrap_qty ?? 0) + Math.max(0, args.scrap ?? 0),
    downtime_minutes:
      (cur.downtime_minutes ?? 0) + Math.max(0, args.downtime_minutes ?? 0),
    setup_minutes:
      (cur.setup_minutes ?? 0) + Math.max(0, args.setup_minutes ?? 0),
  };
  const { error: uErr } = await supabase
    .from("production_entries")
    .update(next)
    .eq("id", ensured.id);
  if (uErr) return { error: uErr.message };

  revalidatePath("/production");
  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  return { success: true, id: ensured.id };
}

/**
 * Close today's open entries for this machine. Stamps end_time with
 * the current Turkey-time HH:MM. End-of-shift housekeeping.
 */
export async function closeShiftForMachine(machineId: string) {
  const supabase = await createClient();
  const today = turkeyTodayISO();
  const nowHHMM = new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());

  const { error } = await supabase
    .from("production_entries")
    .update({ end_time: nowHHMM })
    .eq("machine_id", machineId)
    .eq("entry_date", today)
    .is("end_time", null);
  if (error) return { error: error.message };
  revalidatePath("/production");
  revalidatePath("/jobs");
  return { success: true };
}

export async function saveProductionEntry(input: {
  id?: string;
  entry_date: string;
  shift: Shift;
  machine_id: string;
  operator_id?: string | null;
  job_id?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  produced_qty: number;
  scrap_qty: number;
  downtime_minutes: number;
  notes?: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const payload = {
    entry_date: input.entry_date,
    shift: input.shift,
    machine_id: input.machine_id,
    operator_id: input.operator_id || null,
    job_id: input.job_id || null,
    start_time: input.start_time || null,
    end_time: input.end_time || null,
    produced_qty: input.produced_qty,
    scrap_qty: input.scrap_qty,
    downtime_minutes: input.downtime_minutes,
    notes: input.notes || null,
    created_by: input.id ? undefined : user?.id,
  };

  const { error } = input.id
    ? await supabase.from("production_entries").update(payload).eq("id", input.id)
    : await supabase.from("production_entries").insert(payload);

  if (error) return { error: error.message };

  revalidatePath("/production");
  revalidatePath("/dashboard");
  revalidatePath("/machines");
  return { success: true };
}

export async function deleteProductionEntry(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("production_entries").delete().eq("id", id);
  if (error) {
    const { humanizeDeleteError } = await import("@/lib/delete-helpers");
    return { error: humanizeDeleteError(error.message, "üretim kaydı") };
  }
  revalidatePath("/production");
  return { success: true };
}

/**
 * Save many entries in one go — used by the "multiple entries on one
 * shift" flow. All entries share date/shift/machine/operator at the
 * call site; each row supplies its own job + qty + notes.
 *
 * Atomic: if any insert fails (RLS, FK), nothing is written.
 */
export async function bulkSaveProductionEntries(input: {
  entry_date: string;
  shift: "sabah" | "aksam" | "gece";
  machine_id: string;
  operator_id?: string | null;
  rows: Array<{
    job_id?: string | null;
    start_time?: string | null;
    end_time?: string | null;
    produced_qty: number;
    scrap_qty?: number;
    downtime_minutes?: number;
    notes?: string | null;
  }>;
}) {
  if (!input.rows || input.rows.length === 0) {
    return { error: "En az bir giriş gerekli" };
  }
  const supabase = await createClient();
  const payload = input.rows.map((r) => ({
    entry_date: input.entry_date,
    shift: input.shift,
    machine_id: input.machine_id,
    operator_id: input.operator_id || null,
    job_id: r.job_id || null,
    start_time: r.start_time || null,
    end_time: r.end_time || null,
    produced_qty: r.produced_qty,
    scrap_qty: r.scrap_qty ?? 0,
    downtime_minutes: r.downtime_minutes ?? 0,
    notes: r.notes || null,
  }));
  const { error } = await supabase.from("production_entries").insert(payload);
  if (error) return { error: error.message };
  revalidatePath("/production");
  revalidatePath("/dashboard");
  revalidatePath("/machines");
  return { success: true, count: payload.length };
}

export async function bulkDeleteProductionEntries(ids: string[]) {
  if (!ids || ids.length === 0) return { error: "Seçili kayıt yok" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("production_entries")
    .delete()
    .in("id", ids);
  if (error) {
    const { humanizeDeleteError } = await import("@/lib/delete-helpers");
    return { error: humanizeDeleteError(error.message, "üretim kayıtları") };
  }
  revalidatePath("/production");
  revalidatePath("/dashboard");
  return { success: true };
}
