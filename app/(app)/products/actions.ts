"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { humanizeDeleteError } from "@/lib/delete-helpers";
import type {
  ProductCurrency,
  ProductProcess,
  ProductStatus,
} from "@/lib/supabase/types";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null as never, error: "Giriş gerekli" };
  return { supabase, user };
}

export interface SaveProductInput {
  id?: string;
  // Identification
  code: string;
  name: string;
  description?: string | null;
  customer?: string | null;
  customer_part_no?: string | null;
  customer_drawing_ref?: string | null;
  // Classification
  category?: string | null;
  status?: ProductStatus;
  revision?: string | null;
  revision_date?: string | null;
  tags?: string[];
  // Material / surface / heat
  material?: string | null;
  surface_treatment?: string | null;
  heat_treatment?: string | null;
  hardness?: string | null;
  // Dimensions
  weight_kg?: number | null;
  length_mm?: number | null;
  width_mm?: number | null;
  height_mm?: number | null;
  diameter_mm?: number | null;
  tolerance_class?: string | null;
  surface_finish_ra?: number | null;
  // Manufacturing
  process_type?: ProductProcess | null;
  cycle_time_minutes?: number | null;
  cleanup_time_minutes?: number | null;
  setup_time_minutes?: number | null;
  parts_per_setup?: number | null;
  default_machine_id?: string | null;
  // Commercial
  default_quantity?: number | null;
  min_order_qty?: number | null;
  unit_price?: number | null;
  currency?: ProductCurrency | null;
  // Notes
  notes?: string | null;
  // Default tool list (replace strategy)
  tools?: Array<{ tool_id: string; quantity_used: number; notes?: string | null }>;
  // Per-machine timing overrides (replace strategy — only rows with at
  // least one non-null field are kept; previous overrides for machines
  // not in the array are deleted).
  machine_cycles?: Array<{
    machine_id: string;
    cycle_seconds: number | null;
    swap_seconds: number | null;
    setup_seconds: number | null;
    parts_per_setup: number | null;
  }>;
}

function nullableNumber(n: number | null | undefined): number | null {
  if (n === undefined || n === null) return null;
  if (!Number.isFinite(n)) return null;
  return n;
}

/** Detect "table doesn't exist" / "schema cache miss" so we can degrade
 *  gracefully when a migration hasn't been applied yet. */
function isMissingTableError(err: { message?: string; code?: string }): boolean {
  if (err.code === "42P01" || err.code === "PGRST205") return true;
  const m = err.message?.toLowerCase() ?? "";
  return (
    m.includes("could not find the table") ||
    m.includes("schema cache") ||
    m.includes("does not exist") ||
    m.includes("relation") && m.includes("does not exist")
  );
}

export async function saveProduct(input: SaveProductInput) {
  const { supabase, user, error } = await requireUser();
  if (error) return { error };
  const code = input.code.trim();
  const name = input.name.trim();
  if (!code) return { error: "Ürün kodu gerekli" };
  if (!name) return { error: "Ürün adı gerekli" };

  // Dedupe + normalize tags
  const tags = (input.tags ?? [])
    .map((t) => t.trim().toLocaleLowerCase("tr"))
    .filter((t, i, a) => t.length > 0 && t.length <= 30 && a.indexOf(t) === i)
    .slice(0, 16);

  const payload = {
    code,
    name,
    description: input.description?.trim() || null,
    customer: input.customer?.trim() || null,
    customer_part_no: input.customer_part_no?.trim() || null,
    customer_drawing_ref: input.customer_drawing_ref?.trim() || null,
    category: input.category?.trim() || null,
    status: input.status ?? "aktif",
    revision: input.revision?.trim() || null,
    revision_date: input.revision_date || null,
    tags,
    material: input.material?.trim() || null,
    surface_treatment: input.surface_treatment?.trim() || null,
    heat_treatment: input.heat_treatment?.trim() || null,
    hardness: input.hardness?.trim() || null,
    weight_kg: nullableNumber(input.weight_kg),
    length_mm: nullableNumber(input.length_mm),
    width_mm: nullableNumber(input.width_mm),
    height_mm: nullableNumber(input.height_mm),
    diameter_mm: nullableNumber(input.diameter_mm),
    tolerance_class: input.tolerance_class?.trim() || null,
    surface_finish_ra: nullableNumber(input.surface_finish_ra),
    process_type: input.process_type ?? null,
    cycle_time_minutes: nullableNumber(input.cycle_time_minutes),
    cleanup_time_minutes: nullableNumber(input.cleanup_time_minutes),
    setup_time_minutes: nullableNumber(input.setup_time_minutes),
    parts_per_setup: nullableNumber(input.parts_per_setup),
    default_machine_id: input.default_machine_id || null,
    default_quantity: nullableNumber(input.default_quantity),
    min_order_qty: nullableNumber(input.min_order_qty),
    unit_price: nullableNumber(input.unit_price),
    currency: input.currency ?? "TRY",
    notes: input.notes?.trim() || null,
    created_by: user.id,
  };

  let productId = input.id ?? null;
  if (productId) {
    const { data, error: e } = await supabase
      .from("products")
      .update(payload)
      .eq("id", productId)
      .select("id")
      .maybeSingle();
    if (e) return { error: e.message };
    if (!data) return { error: "Ürün güncellenemedi (yetki yok ya da silinmiş)" };
  } else {
    const { data, error: e } = await supabase
      .from("products")
      .insert(payload)
      .select("id")
      .single();
    if (e || !data) return { error: e?.message ?? "Ürün oluşturulamadı" };
    productId = data.id;
  }

  // Sync default tools (replace strategy — easy to reason about).
  if (input.tools !== undefined) {
    await supabase.from("product_tools").delete().eq("product_id", productId);
    if (input.tools.length > 0) {
      const { error: tErr } = await supabase.from("product_tools").insert(
        input.tools.map((t) => ({
          product_id: productId!,
          tool_id: t.tool_id,
          quantity_used: t.quantity_used,
          notes: t.notes ?? null,
        })),
      );
      if (tErr) return { error: tErr.message };
    }
  }

  // Sync per-machine cycle overrides (replace strategy).
  // DEFENSIVE: tolerate the table not existing (migration 0035 not yet
  // applied on this Supabase instance). If the schema is missing we just
  // skip — operator can still save the product. PostgREST signals
  // "schema cache" / 42P01 (undefined_table) for this case.
  if (input.machine_cycles !== undefined) {
    try {
      const delRes = await supabase
        .from("product_machine_cycles")
        .delete()
        .eq("product_id", productId);
      if (delRes.error && !isMissingTableError(delRes.error)) {
        return { error: delRes.error.message };
      }
      if (
        !delRes.error || // delete succeeded
        !isMissingTableError(delRes.error)
      ) {
        if (input.machine_cycles.length > 0 && !delRes.error) {
          const { error: mcErr } = await supabase
            .from("product_machine_cycles")
            .insert(
              input.machine_cycles.map((c) => ({
                product_id: productId!,
                machine_id: c.machine_id,
                cycle_seconds: c.cycle_seconds,
                swap_seconds: c.swap_seconds,
                setup_seconds: c.setup_seconds,
                parts_per_setup: c.parts_per_setup,
              })),
            );
          if (mcErr && !isMissingTableError(mcErr)) {
            return { error: mcErr.message };
          }
        }
      }
    } catch (e) {
      console.warn(
        "[saveProduct] product_machine_cycles sync skipped:",
        e instanceof Error ? e.message : e,
      );
    }
  }

  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  revalidatePath("/jobs");
  return { id: productId };
}

export async function deleteProduct(id: string) {
  const { supabase, error } = await requireUser();
  if (error) return { error };

  // Cascade quality cleanup BEFORE deleting the product.
  // jobs.product_id is ON DELETE SET NULL — the jobs themselves persist,
  // but we want to wipe their quality data because the user's intent
  // was "this product is gone, its measurements should go too".
  const { data: jobIdsRows } = await supabase
    .from("jobs")
    .select("id")
    .eq("product_id", id);
  const jobIds = (jobIdsRows ?? []).map((r) => r.id as string);
  let removedSpecs = 0;
  let removedMeas = 0;
  if (jobIds.length > 0) {
    const { data: spec } = await supabase
      .from("quality_specs")
      .delete()
      .in("job_id", jobIds)
      .select("id");
    removedSpecs = (spec ?? []).length;
    const { data: meas } = await supabase
      .from("quality_measurements")
      .delete()
      .in("job_id", jobIds)
      .select("id");
    removedMeas = (meas ?? []).length;
    await supabase.from("quality_reviews").delete().in("job_id", jobIds);
  }

  // Best-effort: clean up product images (storage objects) before row delete.
  const { data: imgs } = await supabase
    .from("product_images")
    .select("image_path")
    .eq("product_id", id);
  const { data, error: e } = await supabase
    .from("products")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (e) return { error: humanizeDeleteError(e.message, "ürün") };
  if (!data) return { error: "Ürün silinemedi (yetki yok ya da bulunamadı)" };
  const paths = (imgs ?? [])
    .map((r) => r.image_path)
    .filter((p): p is string => !!p);
  if (paths.length > 0) {
    void supabase.storage.from("product-images").remove(paths);
  }
  revalidatePath("/products");
  revalidatePath("/quality");
  return {
    success: true,
    affectedJobs: jobIds.length,
    removedSpecs,
    removedMeasurements: removedMeas,
  };
}

export async function bulkDeleteProducts(ids: string[]) {
  if (!ids || ids.length === 0) return { error: "Seçili ürün yok" };
  const { supabase, error } = await requireUser();
  if (error) return { error };

  // Cascade quality cleanup for all jobs tied to these products.
  const { data: jobIdsRows } = await supabase
    .from("jobs")
    .select("id")
    .in("product_id", ids);
  const jobIds = (jobIdsRows ?? []).map((r) => r.id as string);
  if (jobIds.length > 0) {
    await supabase.from("quality_specs").delete().in("job_id", jobIds);
    await supabase.from("quality_measurements").delete().in("job_id", jobIds);
    await supabase.from("quality_reviews").delete().in("job_id", jobIds);
  }

  const { data: imgs } = await supabase
    .from("product_images")
    .select("image_path")
    .in("product_id", ids);
  const { error: e } = await supabase.from("products").delete().in("id", ids);
  if (e) return { error: humanizeDeleteError(e.message, "ürünler") };
  const paths = (imgs ?? [])
    .map((r) => r.image_path)
    .filter((p): p is string => !!p);
  if (paths.length > 0) {
    void supabase.storage.from("product-images").remove(paths);
  }
  revalidatePath("/products");
  revalidatePath("/quality");
  return { success: true };
}

/**
 * Materialize a product's default tool list into a job. Called by the
 * Job dialog after the user picks a product so job_tools is populated
 * without manual data entry.
 */
export async function materializeProductIntoJob(
  jobId: string,
  productId: string,
) {
  const { supabase, error } = await requireUser();
  if (error) return { error };
  const { data: tools, error: tErr } = await supabase
    .from("product_tools")
    .select("tool_id, quantity_used, notes")
    .eq("product_id", productId);
  if (tErr) return { error: tErr.message };
  await supabase.from("job_tools").delete().eq("job_id", jobId);
  if (tools && tools.length > 0) {
    const { error: jErr } = await supabase.from("job_tools").insert(
      tools.map((t) => ({
        job_id: jobId,
        tool_id: t.tool_id,
        quantity_used: t.quantity_used,
        notes: t.notes,
      })),
    );
    if (jErr) return { error: jErr.message };
  }
  revalidatePath(`/jobs`);
  return { success: true, count: tools?.length ?? 0 };
}

// ── Image gallery actions ───────────────────────────────────────────

export async function uploadProductImage(productId: string, formData: FormData) {
  const { supabase, user, error } = await requireUser();
  if (error) return { error };

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "Dosya seçilmedi" };
  if (!file.type.startsWith("image/")) {
    return { error: "Sadece görsel dosyaları yüklenebilir." };
  }
  if (file.size > 8 * 1024 * 1024) {
    return { error: "Dosya boyutu en fazla 8 MB olabilir." };
  }

  const ts = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const path = `${user.id}/${productId}/${ts}_${safeName}`;

  const { error: upErr } = await supabase.storage
    .from("product-images")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) return { error: "Yüklenemedi: " + upErr.message };

  // Determine if this should become primary: yes if no images exist yet.
  const { count } = await supabase
    .from("product_images")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId);
  const isFirst = (count ?? 0) === 0;

  const { error: insErr } = await supabase.from("product_images").insert({
    product_id: productId,
    image_path: path,
    sort_order: count ?? 0,
    is_primary: isFirst,
    uploaded_by: user.id,
  });
  if (insErr) {
    await supabase.storage.from("product-images").remove([path]);
    return { error: insErr.message };
  }

  revalidatePath(`/products/${productId}`);
  revalidatePath("/products");
  return { success: true, path };
}

export async function deleteProductImage(imageId: string) {
  const { supabase, error } = await requireUser();
  if (error) return { error };
  const { data: row } = await supabase
    .from("product_images")
    .select("image_path, product_id, is_primary")
    .eq("id", imageId)
    .single();
  if (!row) return { error: "Görsel bulunamadı" };

  const { error: delErr } = await supabase
    .from("product_images")
    .delete()
    .eq("id", imageId);
  if (delErr) return { error: delErr.message };

  await supabase.storage.from("product-images").remove([row.image_path]);

  // If this was the primary image, promote the next one (lowest sort_order).
  if (row.is_primary) {
    const { data: next } = await supabase
      .from("product_images")
      .select("id")
      .eq("product_id", row.product_id)
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (next) {
      await supabase
        .from("product_images")
        .update({ is_primary: true })
        .eq("id", next.id);
    }
  }

  revalidatePath(`/products/${row.product_id}`);
  revalidatePath("/products");
  return { success: true };
}

// ── Inline tool CRUD (used by the product detail Tools tab) ───────

export async function addProductTool(
  productId: string,
  toolId: string,
  qty: number,
) {
  const { supabase, error } = await requireUser();
  if (error) return { error };
  if (qty < 1 || !Number.isFinite(qty)) qty = 1;
  const { error: e } = await supabase
    .from("product_tools")
    .upsert(
      {
        product_id: productId,
        tool_id: toolId,
        quantity_used: Math.floor(qty),
      },
      { onConflict: "product_id,tool_id" },
    );
  if (e) return { error: e.message };
  revalidatePath(`/products/${productId}`);
  return { success: true };
}

export async function removeProductTool(productId: string, toolId: string) {
  const { supabase, error } = await requireUser();
  if (error) return { error };
  const { error: e } = await supabase
    .from("product_tools")
    .delete()
    .eq("product_id", productId)
    .eq("tool_id", toolId);
  if (e) return { error: e.message };
  revalidatePath(`/products/${productId}`);
  return { success: true };
}

export async function updateProductToolQty(
  productId: string,
  toolId: string,
  qty: number,
) {
  const { supabase, error } = await requireUser();
  if (error) return { error };
  if (qty < 1 || !Number.isFinite(qty)) {
    return { error: "Adet pozitif tam sayı olmalı" };
  }
  const { data, error: e } = await supabase
    .from("product_tools")
    .update({ quantity_used: Math.floor(qty) })
    .eq("product_id", productId)
    .eq("tool_id", toolId)
    .select("tool_id")
    .maybeSingle();
  if (e) return { error: e.message };
  if (!data) return { error: "Takım bulunamadı" };
  revalidatePath(`/products/${productId}`);
  return { success: true };
}

export async function setPrimaryProductImage(imageId: string) {
  const { supabase, error } = await requireUser();
  if (error) return { error };
  const { data: row } = await supabase
    .from("product_images")
    .select("product_id")
    .eq("id", imageId)
    .single();
  if (!row) return { error: "Görsel bulunamadı" };

  // Clear existing primary then set new one (one-primary unique index
  // prevents two primaries at once anyway, but explicit is clearer).
  await supabase
    .from("product_images")
    .update({ is_primary: false })
    .eq("product_id", row.product_id);
  const { error: updErr } = await supabase
    .from("product_images")
    .update({ is_primary: true })
    .eq("id", imageId);
  if (updErr) return { error: updErr.message };

  revalidatePath(`/products/${row.product_id}`);
  revalidatePath("/products");
  return { success: true };
}
