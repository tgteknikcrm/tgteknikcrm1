"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Shift } from "@/lib/supabase/types";

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
