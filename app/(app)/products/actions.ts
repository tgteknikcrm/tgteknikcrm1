"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { humanizeDeleteError } from "@/lib/delete-helpers";

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
  code: string;
  name: string;
  description?: string | null;
  customer?: string | null;
  default_quantity?: number | null;
  notes?: string | null;
  // Default tools attached to this product. Replaces existing rows.
  tools?: Array<{ tool_id: string; quantity_used: number; notes?: string | null }>;
}

export async function saveProduct(input: SaveProductInput) {
  const { supabase, user, error } = await requireUser();
  if (error) return { error };
  const code = input.code.trim();
  const name = input.name.trim();
  if (!code) return { error: "Ürün kodu gerekli" };
  if (!name) return { error: "Ürün adı gerekli" };

  const payload = {
    code,
    name,
    description: input.description?.trim() || null,
    customer: input.customer?.trim() || null,
    default_quantity: input.default_quantity ?? null,
    notes: input.notes?.trim() || null,
    created_by: user.id,
  };

  let productId = input.id ?? null;
  if (productId) {
    const { error: e } = await supabase
      .from("products")
      .update(payload)
      .eq("id", productId);
    if (e) return { error: e.message };
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

  revalidatePath("/products");
  revalidatePath("/jobs");
  return { id: productId };
}

export async function deleteProduct(id: string) {
  const { supabase, error } = await requireUser();
  if (error) return { error };
  const { error: e } = await supabase.from("products").delete().eq("id", id);
  if (e) return { error: humanizeDeleteError(e.message, "ürün") };
  revalidatePath("/products");
  return { success: true };
}

export async function bulkDeleteProducts(ids: string[]) {
  if (!ids || ids.length === 0) return { error: "Seçili ürün yok" };
  const { supabase, error } = await requireUser();
  if (error) return { error };
  const { error: e } = await supabase.from("products").delete().in("id", ids);
  if (e) return { error: humanizeDeleteError(e.message, "ürünler") };
  revalidatePath("/products");
  return { success: true };
}

/**
 * Materialize a product's default tool list into a job. Called by the
 * Job dialog after the user picks a product so job_tools is populated
 * without manual data entry.
 *
 * Replaces the job's existing tools — caller should warn the user
 * before invoking when job already has tools.
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
  // Replace existing job_tools
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
