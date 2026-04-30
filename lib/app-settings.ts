import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_WORK_SCHEDULE,
  type WorkSchedule,
} from "@/lib/supabase/types";

/**
 * Read the work schedule from app_settings. Returns the default
 * Pzt-Cum 9 saat config if the row doesn't exist or fetch fails.
 *
 * Server-side only — uses the cookie-bound supabase client.
 */
export async function getWorkSchedule(): Promise<WorkSchedule> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "work_schedule")
      .maybeSingle();
    if (!data?.value) return DEFAULT_WORK_SCHEDULE;
    const v = data.value as WorkSchedule;
    if (!Array.isArray(v.days) || v.days.length !== 7) {
      return DEFAULT_WORK_SCHEDULE;
    }
    return v;
  } catch {
    return DEFAULT_WORK_SCHEDULE;
  }
}
