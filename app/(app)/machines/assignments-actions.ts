"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { recordEvent } from "@/lib/activity";
import { SHIFT_LABEL, type Shift } from "@/lib/supabase/types";

// Upsert: if (machine, shift) pair already exists, overwrite operator.
export async function assignOperator(input: {
  machine_id: string;
  shift: Shift;
  operator_id: string;
  notes?: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const payload = {
    machine_id: input.machine_id,
    shift: input.shift,
    operator_id: input.operator_id,
    notes: input.notes?.trim() || null,
    assigned_by: user?.id ?? null,
  };

  const { error } = await supabase
    .from("machine_shift_assignments")
    .upsert(payload, { onConflict: "machine_id,shift" });

  if (error) return { error: error.message };

  const [{ data: m }, { data: o }] = await Promise.all([
    supabase.from("machines").select("name").eq("id", input.machine_id).single(),
    supabase.from("operators").select("full_name").eq("id", input.operator_id).single(),
  ]);
  await recordEvent({
    type: "machine.shift_assigned",
    entity_type: "machine",
    entity_id: input.machine_id,
    entity_label: m?.name ?? null,
    metadata: {
      shift: input.shift,
      shift_label: SHIFT_LABEL[input.shift],
      operator: o?.full_name ?? null,
    },
  });

  revalidatePath(`/machines/${input.machine_id}`);
  revalidatePath("/machines");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function clearAssignment(id: string, machineId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("machine_shift_assignments")
    .delete()
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/machines/${machineId}`);
  revalidatePath("/machines");
  revalidatePath("/dashboard");
  return { success: true };
}
