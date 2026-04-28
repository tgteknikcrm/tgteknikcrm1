"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { recordEvent } from "@/lib/activity";
import {
  calculateQcResult,
  type QcCharacteristicType,
  type QcReviewerRole,
  type QcReviewStatus,
} from "@/lib/supabase/types";

export interface SaveSpecInput {
  id?: string;
  job_id: string;
  bubble_no?: number | null;
  characteristic_type: QcCharacteristicType;
  description: string;
  nominal_value: number;
  tolerance_plus: number;
  tolerance_minus: number;
  unit: string;
  measurement_tool?: string | null;
  is_critical: boolean;
  drawing_id?: string | null;
  bubble_x?: number | null;
  bubble_y?: number | null;
  notes?: string | null;
}

export async function saveSpec(input: SaveSpecInput) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id ?? null;

  if (!input.description?.trim()) {
    return { error: "Açıklama zorunlu." };
  }
  if (!Number.isFinite(input.nominal_value)) {
    return { error: "Nominal değer geçersiz." };
  }
  if (input.tolerance_plus < 0 || input.tolerance_minus < 0) {
    return { error: "Tolerans değerleri negatif olamaz." };
  }

  const payload = {
    job_id: input.job_id,
    bubble_no:
      input.bubble_no === null || input.bubble_no === undefined
        ? null
        : Number(input.bubble_no),
    characteristic_type: input.characteristic_type,
    description: input.description.trim(),
    nominal_value: Number(input.nominal_value),
    tolerance_plus: Number(input.tolerance_plus),
    tolerance_minus: Number(input.tolerance_minus),
    unit: input.unit?.trim() || "mm",
    measurement_tool: input.measurement_tool?.trim() || null,
    is_critical: !!input.is_critical,
    drawing_id: input.drawing_id || null,
    bubble_x:
      input.bubble_x === null || input.bubble_x === undefined
        ? null
        : Number(input.bubble_x),
    bubble_y:
      input.bubble_y === null || input.bubble_y === undefined
        ? null
        : Number(input.bubble_y),
    notes: input.notes?.trim() || null,
  };

  if (input.id) {
    const { error } = await supabase
      .from("quality_specs")
      .update(payload)
      .eq("id", input.id);
    if (error) return { error: error.message };
  } else {
    const { data: ins, error } = await supabase
      .from("quality_specs")
      .insert({ ...payload, created_by: userId })
      .select("id")
      .single();
    if (error) return { error: error.message };
    await recordEvent({
      type: "spec.created",
      entity_type: "spec",
      entity_id: ins.id as string,
      entity_label: payload.description,
      metadata: {
        job_id: input.job_id,
        bubble_no: payload.bubble_no,
        nominal: payload.nominal_value,
        unit: payload.unit,
      },
    });
  }

  revalidatePath("/quality");
  revalidatePath(`/quality/${input.job_id}`);
  return { success: true };
}

export async function deleteSpec(id: string, jobId: string) {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("quality_specs")
    .select("description, bubble_no")
    .eq("id", id)
    .single();
  const { error } = await supabase.from("quality_specs").delete().eq("id", id);
  if (error) return { error: error.message };
  await recordEvent({
    type: "spec.deleted",
    entity_type: "spec",
    entity_id: id,
    entity_label: existing?.description ?? null,
    metadata: { job_id: jobId, bubble_no: existing?.bubble_no },
  });
  revalidatePath("/quality");
  revalidatePath(`/quality/${jobId}`);
  return { success: true };
}

export interface SaveMeasurementInput {
  id?: string;
  spec_id: string;
  job_id: string;
  part_serial?: string | null;
  measured_value: number;
  measurement_tool?: string | null;
  notes?: string | null;
}

export async function saveMeasurement(input: SaveMeasurementInput) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id ?? null;

  if (!Number.isFinite(input.measured_value)) {
    return { error: "Ölçülen değer geçersiz." };
  }

  // Fetch spec to compute result server-side (don't trust client)
  const specRes = await supabase
    .from("quality_specs")
    .select("nominal_value, tolerance_plus, tolerance_minus")
    .eq("id", input.spec_id)
    .single();
  if (specRes.error || !specRes.data) {
    return { error: "Spec bulunamadı." };
  }
  const result = calculateQcResult(
    Number(input.measured_value),
    Number(specRes.data.nominal_value),
    Number(specRes.data.tolerance_plus),
    Number(specRes.data.tolerance_minus),
  );

  const payload = {
    spec_id: input.spec_id,
    job_id: input.job_id,
    part_serial: input.part_serial?.trim() || null,
    measured_value: Number(input.measured_value),
    result,
    measurement_tool: input.measurement_tool?.trim() || null,
    notes: input.notes?.trim() || null,
  };

  if (input.id) {
    const { error } = await supabase
      .from("quality_measurements")
      .update(payload)
      .eq("id", input.id);
    if (error) return { error: error.message };
  } else {
    const { data: ins, error } = await supabase
      .from("quality_measurements")
      .insert({ ...payload, measured_by: userId })
      .select("id")
      .single();
    if (error) return { error: error.message };
    // NOK gets its own fail-safe trigger event; here we always record the
    // measurement.created event for the feed.
    await recordEvent({
      type: "measurement.created",
      entity_type: "measurement",
      entity_id: ins.id as string,
      entity_label: payload.part_serial ?? "—",
      metadata: {
        job_id: input.job_id,
        spec_id: input.spec_id,
        measured: payload.measured_value,
        result: payload.result,
      },
    });
  }

  revalidatePath("/quality");
  revalidatePath(`/quality/${input.job_id}`);
  return { success: true, result };
}

export interface BulkMeasurementInput {
  job_id: string;
  part_serial?: string | null;
  entries: Array<{
    spec_id: string;
    measured_value: number;
    measurement_tool?: string | null;
    notes?: string | null;
  }>;
}

export async function saveBulkMeasurements(input: BulkMeasurementInput) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id ?? null;

  if (input.entries.length === 0) {
    return { error: "Ölçüm yok." };
  }

  // Fetch all specs in one query for tolerance calculation
  const specIds = input.entries.map((e) => e.spec_id);
  const specsRes = await supabase
    .from("quality_specs")
    .select("id, nominal_value, tolerance_plus, tolerance_minus")
    .in("id", specIds);
  if (specsRes.error || !specsRes.data) {
    return { error: specsRes.error?.message || "Spec'ler okunamadı." };
  }

  const specMap = new Map(
    specsRes.data.map((s) => [
      s.id as string,
      {
        nominal: Number(s.nominal_value),
        plus: Number(s.tolerance_plus),
        minus: Number(s.tolerance_minus),
      },
    ]),
  );

  const rows = input.entries
    .filter((e) => Number.isFinite(e.measured_value))
    .map((e) => {
      const s = specMap.get(e.spec_id);
      if (!s) return null;
      return {
        spec_id: e.spec_id,
        job_id: input.job_id,
        part_serial: input.part_serial?.trim() || null,
        measured_value: Number(e.measured_value),
        result: calculateQcResult(
          Number(e.measured_value),
          s.nominal,
          s.plus,
          s.minus,
        ),
        measurement_tool: e.measurement_tool?.trim() || null,
        notes: e.notes?.trim() || null,
        measured_by: userId,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length === 0) {
    return { error: "Geçerli ölçüm yok." };
  }

  const { error } = await supabase.from("quality_measurements").insert(rows);
  if (error) return { error: error.message };

  await recordEvent({
    type: "measurement.created",
    entity_type: "measurement",
    entity_label: input.part_serial?.trim() || "—",
    metadata: {
      job_id: input.job_id,
      bulk: true,
      count: rows.length,
      ok: rows.filter((r) => r.result === "ok").length,
      sinirda: rows.filter((r) => r.result === "sinirda").length,
      nok: rows.filter((r) => r.result === "nok").length,
    },
  });

  revalidatePath("/quality");
  revalidatePath(`/quality/${input.job_id}`);
  return { success: true, count: rows.length };
}

export async function deleteMeasurement(id: string, jobId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("quality_measurements")
    .delete()
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/quality");
  revalidatePath(`/quality/${jobId}`);
  return { success: true };
}

// ============================================================
// Quality Reviews (sign-off)
// ============================================================
export async function addQualityReview(input: {
  job_id: string;
  reviewer_role: QcReviewerRole;
  status: QcReviewStatus;
  notes?: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Giriş yapılmamış" };

  const { data: ins, error } = await supabase
    .from("quality_reviews")
    .insert({
      job_id: input.job_id,
      reviewer_id: user.id,
      reviewer_role: input.reviewer_role,
      status: input.status,
      notes: input.notes?.trim() || null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  await recordEvent({
    type: "review.created",
    entity_type: "review",
    entity_id: ins.id as string,
    entity_label: `${input.reviewer_role} · ${input.status}`,
    metadata: {
      job_id: input.job_id,
      reviewer_role: input.reviewer_role,
      status: input.status,
    },
  });

  revalidatePath("/quality");
  revalidatePath(`/quality/${input.job_id}`);
  revalidatePath(`/machines`);
  return { success: true };
}

export async function deleteQualityReview(id: string, jobId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("quality_reviews").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/quality/${jobId}`);
  revalidatePath(`/machines`);
  return { success: true };
}

// Delete a drawing used in QC + every spec that referenced it (and via
// FK cascade their measurements). Use when an operator wants to remove
// the entire image from the QC board.
export async function deleteQualityDrawing(drawingId: string, jobId: string) {
  const supabase = await createClient();

  // Snapshot drawing for label + storage path
  const { data: drawing } = await supabase
    .from("drawings")
    .select("title, file_path")
    .eq("id", drawingId)
    .single();

  // Delete specs that reference this drawing within this job. Cascade
  // wipes their measurements automatically.
  const { data: specsDeleted, error: sErr } = await supabase
    .from("quality_specs")
    .delete()
    .eq("drawing_id", drawingId)
    .eq("job_id", jobId)
    .select("id");
  if (sErr) return { error: sErr.message };

  // Delete the drawing row + storage file
  const { error: dErr } = await supabase
    .from("drawings")
    .delete()
    .eq("id", drawingId);
  if (dErr) return { error: dErr.message };

  if (drawing?.file_path) {
    await supabase.storage.from("drawings").remove([drawing.file_path]);
  }

  await recordEvent({
    type: "drawing.deleted",
    entity_type: "drawing",
    entity_id: drawingId,
    entity_label: drawing?.title ?? null,
    metadata: {
      job_id: jobId,
      cascaded_specs: specsDeleted?.length ?? 0,
    },
  });

  revalidatePath("/drawings");
  revalidatePath("/quality");
  revalidatePath(`/quality/${jobId}`);
  return { success: true, removedSpecs: specsDeleted?.length ?? 0 };
}
