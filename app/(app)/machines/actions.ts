"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { recordEvent } from "@/lib/activity";
import {
  MACHINE_STATUS_LABEL,
  type MachineStatus,
  type MachineType,
} from "@/lib/supabase/types";

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

  if (input.id) {
    const { error } = await supabase
      .from("machines")
      .update(payload)
      .eq("id", input.id);
    if (error) return { error: error.message };
  } else {
    const { data, error } = await supabase
      .from("machines")
      .insert(payload)
      .select("id")
      .single();
    if (error) return { error: error.message };
    await recordEvent({
      type: "machine.created",
      entity_type: "machine",
      entity_id: data.id as string,
      entity_label: input.name,
      metadata: { type: input.type },
    });
  }

  revalidatePath("/machines");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteMachine(id: string) {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("machines")
    .select("name")
    .eq("id", id)
    .single();
  const { error } = await supabase.from("machines").delete().eq("id", id);
  if (error) {
    // Map low-level Postgres errors to user-readable Turkish messages.
    return { error: humanizeDeleteError(error.message, "makine") };
  }
  await recordEvent({
    type: "machine.deleted",
    entity_type: "machine",
    entity_id: id,
    entity_label: existing?.name ?? null,
  });
  revalidatePath("/machines");
  revalidatePath("/dashboard");
  return { success: true };
}

/**
 * Translate Postgres / RLS errors into messages an operator can act on.
 * Generic "violates foreign key constraint" is now extremely unlikely
 * after migration 0024 (everything is SET NULL or CASCADE), but if it
 * ever happens we still want a friendly message instead of raw SQL.
 */
function humanizeDeleteError(raw: string, entity: string): string {
  const m = raw.toLowerCase();
  if (m.includes("foreign key") || m.includes("violates")) {
    return `${entity} silinemedi: bağlı kayıtlar var. Yöneticiyle iletişime geç.`;
  }
  if (m.includes("permission") || m.includes("rls") || m.includes("policy")) {
    return `${entity} silme yetkin yok.`;
  }
  if (m.includes("not found")) {
    return `${entity} bulunamadı (zaten silinmiş olabilir).`;
  }
  return raw; // unknown — surface the raw message
}

export async function updateMachineStatus(id: string, status: MachineStatus) {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("machines")
    .select("name, status")
    .eq("id", id)
    .single();
  const { error } = await supabase
    .from("machines")
    .update({ status })
    .eq("id", id);
  if (error) return { error: error.message };
  await recordEvent({
    type: "machine.status_changed",
    entity_type: "machine",
    entity_id: id,
    entity_label: existing?.name ?? null,
    metadata: {
      from: existing?.status,
      to: status,
      from_label: existing?.status
        ? MACHINE_STATUS_LABEL[existing.status as MachineStatus]
        : null,
      to_label: MACHINE_STATUS_LABEL[status],
    },
  });
  revalidatePath("/machines");
  revalidatePath(`/machines/${id}`);
  revalidatePath("/dashboard");
  return { success: true };
}
