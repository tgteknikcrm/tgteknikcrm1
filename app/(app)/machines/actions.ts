"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { MachineStatus, MachineType } from "@/lib/supabase/types";

export async function saveMachine(input: {
  id?: string;
  name: string;
  type: MachineType;
  status: MachineStatus;
  model?: string;
  serial_no?: string;
  location?: string;
  notes?: string;
}) {
  const supabase = await createClient();
  const payload = {
    name: input.name,
    type: input.type,
    status: input.status,
    model: input.model || null,
    serial_no: input.serial_no || null,
    location: input.location || null,
    notes: input.notes || null,
  };

  const { error } = input.id
    ? await supabase.from("machines").update(payload).eq("id", input.id)
    : await supabase.from("machines").insert(payload);

  if (error) return { error: error.message };

  revalidatePath("/machines");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteMachine(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("machines").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/machines");
  return { success: true };
}

export async function updateMachineStatus(id: string, status: MachineStatus) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("machines")
    .update({ status })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/machines");
  revalidatePath(`/machines/${id}`);
  revalidatePath("/dashboard");
  return { success: true };
}
