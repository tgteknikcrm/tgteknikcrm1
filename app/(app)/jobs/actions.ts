"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { JobStatus } from "@/lib/supabase/types";

export async function saveJob(input: {
  id?: string;
  job_no?: string;
  customer: string;
  part_name: string;
  part_no?: string;
  quantity: number;
  machine_id?: string | null;
  operator_id?: string | null;
  status: JobStatus;
  priority: number;
  start_date?: string | null;
  due_date?: string | null;
  notes?: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const payload = {
    job_no: input.job_no || null,
    customer: input.customer,
    part_name: input.part_name,
    part_no: input.part_no || null,
    quantity: input.quantity,
    machine_id: input.machine_id || null,
    operator_id: input.operator_id || null,
    status: input.status,
    priority: input.priority,
    start_date: input.start_date || null,
    due_date: input.due_date || null,
    completed_at: input.status === "tamamlandi" ? new Date().toISOString() : null,
    notes: input.notes || null,
    created_by: input.id ? undefined : user?.id,
  };

  const { error } = input.id
    ? await supabase.from("jobs").update(payload).eq("id", input.id)
    : await supabase.from("jobs").insert(payload);

  if (error) return { error: error.message };

  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteJob(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("jobs").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/jobs");
  return { success: true };
}
