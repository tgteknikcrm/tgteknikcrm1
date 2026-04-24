"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");

  if (!email || !password) {
    return { error: "E-posta ve parola zorunlu." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Giriş başarısız: " + error.message };
  }

  revalidatePath("/", "layout");
  redirect(next || "/dashboard");
}

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();

  if (!email || !password) {
    return { error: "E-posta ve parola zorunlu." };
  }
  if (password.length < 8) {
    return { error: "Parola en az 8 karakter olmalı." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName || email } },
  });

  if (error) {
    return { error: "Kayıt başarısız: " + error.message };
  }

  return { success: "Kayıt oluşturuldu. E-postanı onayla (gerekiyorsa), sonra giriş yap." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
