"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_WORK_SCHEDULE,
  type WorkSchedule,
  type WorkScheduleDay,
} from "@/lib/supabase/types";

function sanitizeDay(d: WorkScheduleDay): WorkScheduleDay {
  return {
    day: d.day,
    enabled: !!d.enabled,
    shift_start: /^[0-9]{2}:[0-9]{2}$/.test(d.shift_start)
      ? d.shift_start
      : "08:00",
    work_minutes: Math.max(0, Math.min(24 * 60, Math.floor(d.work_minutes ?? 0))),
    lunch_minutes: Math.max(
      0,
      Math.min(24 * 60, Math.floor(d.lunch_minutes ?? 0)),
    ),
  };
}

export async function saveWorkSchedule(input: WorkSchedule) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Giriş gerekli" };

  if (!Array.isArray(input.days) || input.days.length !== 7) {
    return { error: "Çizelge 7 gün içermeli" };
  }
  const normalized: WorkSchedule = {
    days: [1, 2, 3, 4, 5, 6, 7].map((day) => {
      const found = input.days.find((d) => d.day === day);
      return found
        ? sanitizeDay(found)
        : DEFAULT_WORK_SCHEDULE.days.find((d) => d.day === day)!;
    }),
  };

  const { error } = await supabase.from("app_settings").upsert(
    {
      key: "work_schedule",
      value: normalized,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
  if (error) return { error: error.message };

  // Bust caches that depend on the schedule (jobs page ETA math, etc.)
  revalidatePath("/jobs");
  revalidatePath("/settings/work-hours");
  return { success: true };
}
