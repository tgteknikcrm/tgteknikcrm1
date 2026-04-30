"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { recordEvent } from "@/lib/activity";
import { JOB_STATUS_LABEL, type JobStatus } from "@/lib/supabase/types";

export async function saveJob(input: {
  id?: string;
  job_no?: string;
  customer: string;
  part_name: string;
  part_no?: string;
  quantity: number;
  machine_id?: string | null;
  operator_id?: string | null;
  product_id?: string | null;
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
    product_id: input.product_id || null,
    status: input.status,
    priority: input.priority,
    start_date: input.start_date || null,
    due_date: input.due_date || null,
    completed_at: input.status === "tamamlandi" ? new Date().toISOString() : null,
    notes: input.notes || null,
    created_by: input.id ? undefined : user?.id,
  };

  if (input.id) {
    const { data: existing } = await supabase
      .from("jobs")
      .select("status")
      .eq("id", input.id)
      .single();
    const { error } = await supabase
      .from("jobs")
      .update(payload)
      .eq("id", input.id);
    if (error) return { error: error.message };
    if (existing && existing.status !== input.status) {
      await recordEvent({
        type: "job.status_changed",
        entity_type: "job",
        entity_id: input.id,
        entity_label: input.part_name,
        metadata: {
          from: existing.status,
          to: input.status,
          from_label: JOB_STATUS_LABEL[existing.status as JobStatus],
          to_label: JOB_STATUS_LABEL[input.status],
        },
      });
    } else {
      await recordEvent({
        type: "job.updated",
        entity_type: "job",
        entity_id: input.id,
        entity_label: input.part_name,
      });
    }
  } else {
    const { data, error } = await supabase
      .from("jobs")
      .insert(payload)
      .select("id")
      .single();
    if (error) return { error: error.message };
    await recordEvent({
      type: "job.created",
      entity_type: "job",
      entity_id: data.id as string,
      entity_label: input.part_name,
      metadata: {
        customer: input.customer,
        quantity: input.quantity,
      },
    });
    revalidatePath("/jobs");
    revalidatePath("/dashboard");
    return { success: true, id: data.id as string };
  }

  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  return { success: true, id: input.id! };
}

export async function deleteJob(id: string) {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("jobs")
    .select("part_name")
    .eq("id", id)
    .single();
  const { error } = await supabase.from("jobs").delete().eq("id", id);
  if (error) return { error: error.message };
  await recordEvent({
    type: "job.deleted",
    entity_type: "job",
    entity_id: id,
    entity_label: existing?.part_name ?? null,
  });
  revalidatePath("/jobs");
  return { success: true };
}

export interface JobToolInput {
  tool_id: string;
  quantity_used: number;
  notes?: string | null;
}

// Replace-all: simpler than diffing, fine at workshop scale.
export async function setJobTools(jobId: string, items: JobToolInput[]) {
  const supabase = await createClient();

  // Validate
  for (const it of items) {
    if (!it.tool_id) return { error: "Takım seçilmedi." };
    if (!(it.quantity_used > 0)) {
      return { error: "Adet 0'dan büyük olmalı." };
    }
  }

  // Wipe existing rows for this job
  const del = await supabase.from("job_tools").delete().eq("job_id", jobId);
  if (del.error) return { error: del.error.message };

  if (items.length > 0) {
    const rows = items.map((it) => ({
      job_id: jobId,
      tool_id: it.tool_id,
      quantity_used: it.quantity_used,
      notes: it.notes?.trim() || null,
    }));
    const ins = await supabase.from("job_tools").insert(rows);
    if (ins.error) return { error: ins.error.message };
  }

  const { data: jobInfo } = await supabase
    .from("jobs")
    .select("part_name")
    .eq("id", jobId)
    .single();
  await recordEvent({
    type: "job.tools_assigned",
    entity_type: "job",
    entity_id: jobId,
    entity_label: jobInfo?.part_name ?? null,
    metadata: { count: items.length },
  });

  revalidatePath("/jobs");
  revalidatePath("/machines");
  return { success: true };
}

export async function bulkDeleteJobs(ids: string[]) {
  if (!ids || ids.length === 0) return { error: "Seçili iş yok" };
  const supabase = await createClient();
  const { error } = await supabase.from("jobs").delete().in("id", ids);
  if (error) {
    const { humanizeDeleteError } = await import("@/lib/delete-helpers");
    return { error: humanizeDeleteError(error.message, "işler") };
  }
  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  return { success: true };
}
