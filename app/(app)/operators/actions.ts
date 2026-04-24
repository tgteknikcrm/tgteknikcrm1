"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Shift } from "@/lib/supabase/types";

export async function saveOperator(input: {
  id?: string;
  full_name: string;
  employee_no?: string;
  phone?: string;
  shift?: Shift | null;
  active: boolean;
  notes?: string;
}) {
  const supabase = await createClient();
  const payload = {
    full_name: input.full_name,
    employee_no: input.employee_no || null,
    phone: input.phone || null,
    shift: input.shift || null,
    active: input.active,
    notes: input.notes || null,
  };
  const { error } = input.id
    ? await supabase.from("operators").update(payload).eq("id", input.id)
    : await supabase.from("operators").insert(payload);
  if (error) return { error: error.message };
  revalidatePath("/operators");
  return { success: true };
}

export async function deleteOperator(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("operators").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/operators");
  return { success: true };
}
