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

  const nowIso = new Date().toISOString();
  // Sync timeline timestamps with the chosen status so create-with-status
  // also lights up the correct step on the Jobs page.
  const stampStartedAt =
    input.status === "ayar" ||
    input.status === "uretimde" ||
    input.status === "tamamlandi"
      ? nowIso
      : null;
  const stampSetupDone =
    input.status === "uretimde" || input.status === "tamamlandi"
      ? nowIso
      : null;

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
    started_at: input.id ? undefined : stampStartedAt,
    setup_completed_at: input.id ? undefined : stampSetupDone,
    completed_at: input.status === "tamamlandi" ? nowIso : null,
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

/**
 * Move a job to a specific step. Stamps started_at /
 * setup_completed_at / completed_at as appropriate so the timeline UI
 * has actual wall-clock anchors.
 *
 * Defansif: .select().maybeSingle() ile RLS-bloklu / wrong id sessiz
 * success'ı yakalar (Supabase silent RLS trap pattern).
 */
export async function setJobStep(jobId: string, step: JobStatus) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Giriş gerekli" };

  const nowIso = new Date().toISOString();
  const updates: Record<string, unknown> = { status: step };

  // Read job context up-front — needed for both timing stamps and
  // auto-creating today's production entry.
  // product_id is used to look up planned setup so we can flag overruns.
  const { data: job } = await supabase
    .from("jobs")
    .select("started_at, setup_completed_at, machine_id, operator_id, product_id")
    .eq("id", jobId)
    .single();

  // Hard-stop: starting setup or production without a machine doesn't
  // make sense — we can't auto-create a production_entry, can't track
  // downtime, can't link to live ticker. Block at the server so the UI
  // can't bypass it.
  if ((step === "ayar" || step === "uretimde") && !job?.machine_id) {
    return {
      error: "Önce işe makine atamalısın — makinesiz ayar/üretim başlatılamaz.",
    };
  }

  // Machine readiness check — if the operator is starting work on this
  // job, the machine must not be broken or in maintenance. If it's just
  // 'durus' (idle), we auto-flip to 'aktif' below so the live ticker
  // ticks. Without this, calcLiveProduced freezes at the downtime
  // session start and the produced count never advances — the user's
  // bug report "üretimde iken step ilerlemiyor".
  let needMachineActivation = false;
  if ((step === "ayar" || step === "uretimde") && job?.machine_id) {
    const { data: mc } = await supabase
      .from("machines")
      .select("status")
      .eq("id", job.machine_id)
      .maybeSingle();
    if (mc?.status === "ariza") {
      return {
        error:
          "Makine ARIZALI — önce arızayı kapat (makine durumunu aktife çek), sonra başlat.",
      };
    }
    if (mc?.status === "bakim") {
      return {
        error:
          "Makine BAKIMDA — bakımı bitir (makine durumunu aktife çek), sonra başlat.",
      };
    }
    if (mc?.status !== "aktif") needMachineActivation = true;
  }

  // Compute setup elapsed minutes if we're transitioning ayar→uretimde
  // and started_at is already stamped. We do this BEFORE writing
  // setup_completed_at so the diff is from the ayar start to "right
  // now", not zero.
  //
  // Math.round + min(1) when ANY time elapsed: a 50-second ayar would
  // floor to 0 and never get recorded (the user's bug — "1 dakika ayar
  // yaptım, ETA değişmiyor"). Any real ayar→uretimde transition logs
  // at least 1 dk so the actual-setup ETA override kicks in.
  let setupElapsedMin = 0;
  if (step === "uretimde" && job?.started_at && !job.setup_completed_at) {
    const elapsedRaw =
      (Date.now() - new Date(job.started_at).getTime()) / 60000;
    setupElapsedMin = elapsedRaw > 0 ? Math.max(1, Math.round(elapsedRaw)) : 0;
  }

  if (step === "ayar") {
    // Always re-stamp started_at when entering ayar — that's the
    // anchor we measure setup time from. If the operator goes back
    // to beklemede and re-enters ayar, we don't want stale timing.
    updates.started_at = nowIso;
    updates.setup_completed_at = null;
    updates.completed_at = null;
  } else if (step === "uretimde") {
    if (!job?.started_at) updates.started_at = nowIso;
    updates.setup_completed_at = nowIso;
    updates.completed_at = null;
  } else if (step === "tamamlandi") {
    // Completion goes through completeJob() — it stamps everything.
    // Direct setJobStep("tamamlandi") is allowed but won't fill the
    // entry; UI funnels through the modal instead.
    updates.completed_at = nowIso;
  } else if (step === "beklemede") {
    updates.started_at = null;
    updates.setup_completed_at = null;
    updates.completed_at = null;
  } else if (step === "iptal") {
    updates.completed_at = nowIso;
  }

  const { data, error } = await supabase
    .from("jobs")
    .update(updates)
    .eq("id", jobId)
    .select("id, customer, part_name")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "İş güncellenemedi (yetki yok ya da silinmiş)" };

  // Flip the machine to 'aktif' the moment ayar/uretimde begins. This
  // also closes any open downtime session (via the 0030 trigger) so
  // calcLiveProduced unfreezes and the produced count starts ticking.
  if (needMachineActivation && job?.machine_id) {
    await supabase
      .from("machines")
      .update({ status: "aktif" })
      .eq("id", job.machine_id);
  }

  // Auto-create today's production entry the moment work starts —
  // either at "Ayara Başla" or "Üretime Başla". Uses UPSERT semantics
  // via the partial unique index so re-clicking is idempotent.
  if ((step === "ayar" || step === "uretimde") && job?.machine_id) {
    try {
      const { openTodayEntryForJob, addSetupMinutesToToday } = await import(
        "../production/actions"
      );
      await openTodayEntryForJob({
        machine_id: job.machine_id,
        job_id: jobId,
        operator_id: job.operator_id ?? null,
      });
      // Record the auto-tracked setup minutes the moment the operator
      // says "ayar bitti, üretime geçiyorum". This is the bug the user
      // hit — clicking Üretime Başla didn't increment anything.
      // Also snapshot the PLANNED minutes (resolved per-machine if
      // override exists) so the production entry knows what was
      // expected vs what actually happened — used by the overrun popup.
      if (step === "uretimde" && setupElapsedMin > 0) {
        let plannedMin: number | null = null;
        if (job.product_id) {
          const [productRes, overrideRes] = await Promise.all([
            supabase
              .from("products")
              .select("setup_time_minutes")
              .eq("id", job.product_id)
              .maybeSingle(),
            supabase
              .from("product_machine_cycles")
              .select("setup_seconds")
              .eq("product_id", job.product_id)
              .eq("machine_id", job.machine_id)
              .maybeSingle(),
          ]);
          if (
            overrideRes.data?.setup_seconds != null &&
            overrideRes.data.setup_seconds > 0
          ) {
            plannedMin = overrideRes.data.setup_seconds / 60;
          } else if (
            productRes.data?.setup_time_minutes != null &&
            productRes.data.setup_time_minutes > 0
          ) {
            plannedMin = Number(productRes.data.setup_time_minutes);
          }
        }
        await addSetupMinutesToToday({
          machine_id: job.machine_id,
          job_id: jobId,
          operator_id: job.operator_id ?? null,
          setup_minutes: setupElapsedMin,
          setup_planned_minutes: plannedMin,
        });
      }
    } catch (e) {
      console.error("openTodayEntryForJob failed:", e);
      // Don't fail the step transition if the entry create errored —
      // the user can still record manually.
    }
  }

  await recordEvent({
    type: "job.status_changed",
    entity_type: "job",
    entity_id: jobId,
    entity_label: `${data.customer} – ${data.part_name}`,
    metadata: { status: step },
  });

  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  revalidatePath("/machines");
  revalidatePath("/production");
  // Surface setup-overrun details to the caller so the UI can pop a
  // reason dialog when the operator's actual setup blew past the plan.
  // Pure data — no DB write here; the popup calls
  // recordSetupOverrunReason after the operator picks a category.
  if (step === "uretimde" && setupElapsedMin > 0) {
    return {
      success: true,
      setupElapsedMin,
      setupTransition: true as const,
    };
  }
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
