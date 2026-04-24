"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function saveSupplier(input: {
  id?: string;
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  active?: boolean;
}) {
  if (!input.name.trim()) return { error: "Tedarikçi adı zorunlu." };

  const supabase = await createClient();
  const payload = {
    name: input.name.trim(),
    contact_person: input.contact_person?.trim() || null,
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    address: input.address?.trim() || null,
    notes: input.notes?.trim() || null,
    active: input.active ?? true,
  };

  const { error, data } = input.id
    ? await supabase.from("suppliers").update(payload).eq("id", input.id).select().single()
    : await supabase.from("suppliers").insert(payload).select().single();

  if (error) return { error: error.message };

  revalidatePath("/suppliers");
  revalidatePath("/orders");
  revalidatePath("/tools");
  return { success: true, supplier: data };
}

export async function deleteSupplier(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("suppliers").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/suppliers");
  return { success: true };
}
