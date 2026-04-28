"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { recordEvent } from "@/lib/activity";
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

  if (input.id) {
    const { error } = await supabase
      .from("operators")
      .update(payload)
      .eq("id", input.id);
    if (error) return { error: error.message };
    await recordEvent({
      type: "operator.updated",
      entity_type: "operator",
      entity_id: input.id,
      entity_label: input.full_name,
    });
  } else {
    const { data, error } = await supabase
      .from("operators")
      .insert(payload)
      .select("id")
      .single();
    if (error) return { error: error.message };
    await recordEvent({
      type: "operator.created",
      entity_type: "operator",
      entity_id: data.id as string,
      entity_label: input.full_name,
    });
  }

  revalidatePath("/operators");
  return { success: true };
}

export async function deleteOperator(id: string) {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("operators")
    .select("full_name")
    .eq("id", id)
    .single();
  const { error } = await supabase.from("operators").delete().eq("id", id);
  if (error) return { error: error.message };
  await recordEvent({
    type: "operator.deleted",
    entity_type: "operator",
    entity_id: id,
    entity_label: existing?.full_name ?? null,
  });
  revalidatePath("/operators");
  return { success: true };
}
