"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { recordEvent } from "@/lib/activity";
import {
  PO_STATUS_LABEL,
  type PoItemCategory,
  type PoStatus,
} from "@/lib/supabase/types";

export interface OrderItemInput {
  id?: string;
  category: PoItemCategory;
  description: string;
  quantity: number;
  unit: string;
  unit_price?: number | null;
  notes?: string | null;
}

export interface SaveOrderInput {
  id?: string;
  order_no?: string | null;
  supplier_id?: string | null;
  status: PoStatus;
  order_date: string; // YYYY-MM-DD
  expected_date?: string | null;
  notes?: string | null;
  items: OrderItemInput[];
}

async function nextOrderNo(): Promise<string> {
  const year = new Date().getFullYear();
  // Build SO-YYYY-XXXX with a quick count of existing same-year orders.
  // Not strictly atomic but enough for low-volume manufacturing shop.
  const supabase = await createClient();
  const { count } = await supabase
    .from("purchase_orders")
    .select("id", { count: "exact", head: true })
    .like("order_no", `SO-${year}-%`);
  const next = (count ?? 0) + 1;
  return `SO-${year}-${String(next).padStart(4, "0")}`;
}

export async function saveOrder(input: SaveOrderInput) {
  const supabase = await createClient();

  if (input.items.length === 0) {
    return { error: "En az bir kalem eklenmeli." };
  }
  for (const it of input.items) {
    if (!it.description?.trim()) {
      return { error: "Her kalemin bir açıklaması olmalı." };
    }
    if (!(it.quantity > 0)) {
      return { error: "Miktar 0'dan büyük olmalı." };
    }
  }

  const headerPayload = {
    order_no: input.order_no?.trim() || (input.id ? undefined : await nextOrderNo()),
    supplier_id: input.supplier_id || null,
    status: input.status,
    order_date: input.order_date,
    expected_date: input.expected_date || null,
    notes: input.notes?.trim() || null,
  };

  let orderId = input.id;
  if (orderId) {
    const { error } = await supabase
      .from("purchase_orders")
      .update(headerPayload)
      .eq("id", orderId);
    if (error) return { error: error.message };

    // Replace items: delete then insert (simpler than diff)
    const del = await supabase
      .from("purchase_order_items")
      .delete()
      .eq("order_id", orderId);
    if (del.error) return { error: del.error.message };
  } else {
    const ins = await supabase
      .from("purchase_orders")
      .insert(headerPayload)
      .select("id")
      .single();
    if (ins.error) return { error: ins.error.message };
    orderId = ins.data!.id as string;
  }

  const itemsPayload = input.items.map((it) => ({
    order_id: orderId!,
    category: it.category,
    description: it.description.trim(),
    quantity: it.quantity,
    unit: it.unit?.trim() || "adet",
    unit_price:
      it.unit_price === null || it.unit_price === undefined ? null : Number(it.unit_price),
    notes: it.notes?.trim() || null,
  }));

  const itemsRes = await supabase.from("purchase_order_items").insert(itemsPayload);
  if (itemsRes.error) return { error: itemsRes.error.message };

  if (!input.id && orderId) {
    await recordEvent({
      type: "order.created",
      entity_type: "order",
      entity_id: orderId,
      entity_label: headerPayload.order_no ?? null,
      metadata: { items: input.items.length, status: input.status },
    });
  }

  revalidatePath("/orders");
  if (orderId) revalidatePath(`/orders/${orderId}`);
  return { success: true, id: orderId };
}

export async function deleteOrder(id: string) {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("purchase_orders")
    .select("order_no")
    .eq("id", id)
    .single();
  const { error } = await supabase.from("purchase_orders").delete().eq("id", id);
  if (error) {
    const { humanizeDeleteError } = await import("@/lib/delete-helpers");
    return { error: humanizeDeleteError(error.message, "sipariş") };
  }
  await recordEvent({
    type: "order.deleted",
    entity_type: "order",
    entity_id: id,
    entity_label: existing?.order_no ?? null,
  });
  revalidatePath("/orders");
  return { success: true };
}

export async function bulkDeleteOrders(ids: string[]) {
  if (!ids || ids.length === 0) return { error: "Seçili sipariş yok" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("purchase_orders")
    .delete()
    .in("id", ids);
  if (error) {
    const { humanizeDeleteError } = await import("@/lib/delete-helpers");
    return { error: humanizeDeleteError(error.message, "siparişler") };
  }
  revalidatePath("/orders");
  return { success: true };
}

export async function updateOrderStatus(id: string, status: PoStatus) {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("purchase_orders")
    .select("order_no, status")
    .eq("id", id)
    .single();
  const { error } = await supabase.from("purchase_orders").update({ status }).eq("id", id);
  if (error) return { error: error.message };
  await recordEvent({
    type: "order.status_changed",
    entity_type: "order",
    entity_id: id,
    entity_label: existing?.order_no ?? null,
    metadata: {
      from: existing?.status,
      to: status,
      from_label: existing?.status ? PO_STATUS_LABEL[existing.status as PoStatus] : null,
      to_label: PO_STATUS_LABEL[status],
    },
  });
  revalidatePath("/orders");
  revalidatePath(`/orders/${id}`);
  return { success: true };
}
