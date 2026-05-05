"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { RawMaterialShape } from "@/lib/supabase/types";

// ─── Raw materials ──────────────────────────────────────────────────

export interface SaveRawMaterialInput {
  id?: string;
  code: string;
  name: string;
  material_grade?: string | null;
  shape: RawMaterialShape;
  diameter_mm?: number | null;
  width_mm?: number | null;
  height_mm?: number | null;
  thickness_mm?: number | null;
  bar_length_mm?: number | null;
  quantity: number;
  unit: string;
  supplier?: string | null;
  location?: string | null;
  notes?: string | null;
  active?: boolean;
}

export async function saveRawMaterial(input: SaveRawMaterialInput) {
  const supabase = await createClient();
  if (!input.code?.trim()) return { error: "Kod zorunlu" };
  if (!input.name?.trim()) return { error: "İsim zorunlu" };

  const payload = {
    code: input.code.trim().toUpperCase(),
    name: input.name.trim(),
    material_grade: input.material_grade?.trim() || null,
    shape: input.shape,
    diameter_mm: input.diameter_mm ?? null,
    width_mm: input.width_mm ?? null,
    height_mm: input.height_mm ?? null,
    thickness_mm: input.thickness_mm ?? null,
    bar_length_mm: input.bar_length_mm ?? null,
    quantity: input.quantity ?? 0,
    unit: input.unit?.trim() || "boy",
    supplier: input.supplier?.trim() || null,
    location: input.location?.trim() || null,
    notes: input.notes?.trim() || null,
    active: input.active ?? true,
  };

  if (input.id) {
    const { error } = await supabase
      .from("raw_materials")
      .update(payload)
      .eq("id", input.id);
    if (error) return { error: error.message };
    revalidatePath("/kesim");
    revalidatePath("/kesim/hammadde");
    return { success: true, id: input.id };
  }
  const { data, error } = await supabase
    .from("raw_materials")
    .insert(payload)
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/kesim");
  revalidatePath("/kesim/hammadde");
  return { success: true, id: data.id as string };
}

export async function deleteRawMaterial(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("raw_materials")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) {
    const { humanizeDeleteError } = await import("@/lib/delete-helpers");
    return { error: humanizeDeleteError(error.message, "hammadde") };
  }
  if (!data) return { error: "Hammadde silinemedi" };
  revalidatePath("/kesim");
  revalidatePath("/kesim/hammadde");
  return { success: true };
}

// ─── Cut pieces ─────────────────────────────────────────────────────

export interface CreateCutInput {
  raw_material_id: string;
  product_id?: string | null;
  cut_length_mm: number;
  // Number of bars/pieces of raw stock that will be consumed.
  bars_consumed: number;
  // Number of cut pieces produced. Often = bars_consumed × (bar_length / cut_length)
  // but we let the operator declare it directly so off-cuts and waste are
  // captured naturally.
  quantity_cut: number;
  lot_no?: string | null;
  location?: string | null;
  notes?: string | null;
}

export async function createCut(input: CreateCutInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Giriş gerekli" };

  if (!input.raw_material_id) return { error: "Hammadde seç" };
  if (!Number.isFinite(input.cut_length_mm) || input.cut_length_mm <= 0) {
    return { error: "Kesim uzunluğu geçersiz" };
  }
  if (!Number.isInteger(input.quantity_cut) || input.quantity_cut <= 0) {
    return { error: "Kesim adedi pozitif tam sayı olmalı" };
  }
  if (
    !Number.isFinite(input.bars_consumed) ||
    input.bars_consumed <= 0
  ) {
    return { error: "Tüketilen boy adedi geçersiz" };
  }

  // Fetch raw material to validate stock.
  const { data: rm, error: rmErr } = await supabase
    .from("raw_materials")
    .select("id, quantity, name")
    .eq("id", input.raw_material_id)
    .single();
  if (rmErr || !rm) return { error: "Hammadde bulunamadı" };
  if (Number(rm.quantity) < input.bars_consumed) {
    return {
      error: `Stokta yetersiz: mevcut ${rm.quantity}, talep ${input.bars_consumed}`,
    };
  }

  // 1. Insert cut_pieces row (qty_cut == qty_remaining initially)
  const { data: cp, error: cpErr } = await supabase
    .from("cut_pieces")
    .insert({
      raw_material_id: input.raw_material_id,
      product_id: input.product_id ?? null,
      cut_length_mm: input.cut_length_mm,
      quantity_cut: input.quantity_cut,
      quantity_remaining: input.quantity_cut,
      cut_by: user.id,
      lot_no: input.lot_no?.trim() || null,
      location: input.location?.trim() || null,
      notes: input.notes?.trim() || null,
    })
    .select("id")
    .single();
  if (cpErr) return { error: cpErr.message };

  // 2. Decrement raw_material quantity
  const newQty = Math.max(0, Number(rm.quantity) - input.bars_consumed);
  const { error: updErr } = await supabase
    .from("raw_materials")
    .update({ quantity: newQty })
    .eq("id", input.raw_material_id);
  if (updErr) {
    // Best-effort rollback of the cut row
    await supabase.from("cut_pieces").delete().eq("id", cp.id);
    return { error: updErr.message };
  }

  revalidatePath("/kesim");
  revalidatePath("/kesim/hammadde");
  revalidatePath("/kesim/yeni");
  return { success: true, id: cp.id as string };
}

export async function deleteCutPiece(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cut_pieces")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Kesim kaydı silinemedi" };
  revalidatePath("/kesim");
  return { success: true };
}

// Consume N pieces from a cut_pieces row (when used in a job or scrap).
export async function consumeCutPiece(id: string, count: number) {
  if (!Number.isInteger(count) || count <= 0) {
    return { error: "Geçersiz adet" };
  }
  const supabase = await createClient();
  const { data: cp, error } = await supabase
    .from("cut_pieces")
    .select("quantity_remaining")
    .eq("id", id)
    .single();
  if (error || !cp) return { error: "Kesim kaydı bulunamadı" };
  if (cp.quantity_remaining < count) {
    return {
      error: `Yetersiz: kalan ${cp.quantity_remaining}, talep ${count}`,
    };
  }
  const { error: updErr } = await supabase
    .from("cut_pieces")
    .update({ quantity_remaining: cp.quantity_remaining - count })
    .eq("id", id);
  if (updErr) return { error: updErr.message };
  revalidatePath("/kesim");
  return { success: true };
}
