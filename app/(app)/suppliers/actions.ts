"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { recordEvent } from "@/lib/activity";

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

  if (!input.id && data) {
    await recordEvent({
      type: "supplier.created",
      entity_type: "supplier",
      entity_id: data.id as string,
      entity_label: payload.name,
    });
  }

  revalidatePath("/suppliers");
  revalidatePath("/orders");
  revalidatePath("/tools");
  return { success: true, supplier: data };
}

export async function deleteSupplier(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("suppliers").delete().eq("id", id);
  if (error) {
    const { humanizeDeleteError } = await import("@/lib/delete-helpers");
    return { error: humanizeDeleteError(error.message, "tedarikçi") };
  }
  revalidatePath("/suppliers");
  return { success: true };
}

export async function bulkDeleteSuppliers(ids: string[]) {
  if (!ids || ids.length === 0) return { error: "Seçili tedarikçi yok" };
  const supabase = await createClient();
  const { error } = await supabase.from("suppliers").delete().in("id", ids);
  if (error) {
    const { humanizeDeleteError } = await import("@/lib/delete-helpers");
    return { error: humanizeDeleteError(error.message, "tedarikçiler") };
  }
  revalidatePath("/suppliers");
  return { success: true };
}
