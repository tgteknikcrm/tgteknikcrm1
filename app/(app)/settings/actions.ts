"use server";

import { createClient, getProfile } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone, phoneToVirtualEmail } from "@/lib/phone";
import { revalidatePath } from "next/cache";
import type { UserRole } from "@/lib/supabase/types";

async function requireAdmin() {
  const me = await getProfile();
  if (!me || me.role !== "admin") {
    throw new Error("Yetkisiz işlem: sadece yönetici.");
  }
  return me;
}

export async function updateUserRole(userId: string, role: UserRole) {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Yetkisiz" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) return { error: error.message };

  revalidatePath("/settings");
  return { success: true };
}

export async function toggleUserActive(userId: string, active: boolean) {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Yetkisiz" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ active }).eq("id", userId);
  if (error) return { error: error.message };

  revalidatePath("/settings");
  return { success: true };
}

export async function deleteUser(userId: string) {
  let me;
  try {
    me = await requireAdmin();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Yetkisiz" };
  }
  if (userId === me.id) {
    return { error: "Kendi hesabını silemezsin." };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };

  // profiles row cascades via FK (auth.users on delete cascade).
  revalidatePath("/settings");
  return { success: true };
}

export async function createUser(formData: FormData) {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Yetkisiz" };
  }

  const rawPhone = String(formData.get("phone") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const role = String(formData.get("role") ?? "operator") as UserRole;

  const phone = normalizePhone(rawPhone);
  if (!phone) return { error: "Geçersiz telefon numarası." };
  if (password.length < 8) return { error: "Parola en az 8 karakter olmalı." };
  if (!fullName) return { error: "Ad Soyad zorunlu." };

  const email = phoneToVirtualEmail(phone);
  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, phone },
  });
  if (error) return { error: error.message };

  // Trigger creates the profile; override its role if the admin picked a non-default.
  if (data?.user && role !== "operator") {
    const supabase = await createClient();
    await supabase.from("profiles").update({ role }).eq("id", data.user.id);
  }

  revalidatePath("/settings");
  return { success: true };
}
