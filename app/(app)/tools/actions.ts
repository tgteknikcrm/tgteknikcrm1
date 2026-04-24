"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ToolCondition } from "@/lib/supabase/types";

export async function saveTool(input: {
  id?: string;
  code?: string;
  name: string;
  type?: string;
  size?: string;
  material?: string;
  location?: string;
  quantity: number;
  min_quantity: number;
  condition: ToolCondition;
  supplier?: string;
  price?: number | null;
  notes?: string;
}) {
  const supabase = await createClient();
  const payload = {
    code: input.code || null,
    name: input.name,
    type: input.type || null,
    size: input.size || null,
    material: input.material || null,
    location: input.location || null,
    quantity: input.quantity,
    min_quantity: input.min_quantity,
    condition: input.condition,
    supplier: input.supplier || null,
    price: input.price ?? null,
    notes: input.notes || null,
  };
  const { error } = input.id
    ? await supabase.from("tools").update(payload).eq("id", input.id)
    : await supabase.from("tools").insert(payload);
  if (error) return { error: error.message };
  revalidatePath("/tools");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteTool(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("tools").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/tools");
  return { success: true };
}
