"use server";

import { createClient } from "@/lib/supabase/server";
import { normalizePhone, phoneToVirtualEmail } from "@/lib/phone";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function signIn(formData: FormData) {
  const rawPhone = String(formData.get("phone") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");

  if (!rawPhone || !password) {
    return { error: "Telefon numarası ve parola zorunlu." };
  }

  const phone = normalizePhone(rawPhone);
  if (!phone) {
    return { error: "Geçersiz telefon numarası. Örn: 0542 646 90 70" };
  }

  const email = phoneToVirtualEmail(phone);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Giriş başarısız: telefon veya parola hatalı." };
  }

  revalidatePath("/", "layout");
  redirect(next || "/dashboard");
}

export async function signUp(formData: FormData) {
  const rawPhone = String(formData.get("phone") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();

  if (!rawPhone || !password) {
    return { error: "Telefon numarası ve parola zorunlu." };
  }

  const phone = normalizePhone(rawPhone);
  if (!phone) {
    return { error: "Geçersiz telefon numarası. Örn: 0542 646 90 70" };
  }
  if (password.length < 8) {
    return { error: "Parola en az 8 karakter olmalı." };
  }

  const email = phoneToVirtualEmail(phone);
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName || phone, phone } },
  });

  if (error) {
    return { error: "Kayıt başarısız: " + error.message };
  }

  return { success: "Kayıt oluşturuldu. Şimdi giriş yapabilirsin." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
