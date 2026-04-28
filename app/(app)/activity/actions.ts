"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function markAllActivityRead() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Giriş yapılmamış" };

  // upsert (user_id, last_read_at = now())
  const { error } = await supabase.from("activity_reads").upsert(
    {
      user_id: user.id,
      last_read_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) return { error: error.message };

  revalidatePath("/activity");
  return { success: true };
}
