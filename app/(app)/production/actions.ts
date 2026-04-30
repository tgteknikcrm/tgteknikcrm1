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
