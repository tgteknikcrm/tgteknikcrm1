import { redirect } from "next/navigation";
import { getProfile } from "@/lib/supabase/server";
import { getWorkSchedule } from "@/lib/app-settings";
import { PageHeader } from "@/components/app/page-header";
import { WorkHoursForm } from "./work-hours-form";

export const metadata = { title: "Çalışma Saatleri" };

export default async function WorkHoursPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/dashboard");

  const schedule = await getWorkSchedule();

  return (
    <div className="max-w-3xl mx-auto pb-8">
      <PageHeader
        title="Çalışma Saatleri"
        description="Haftalık çalışma çizelgesi · İş ETA hesabı bunu kullanır"
      />
      <WorkHoursForm initial={schedule} />
    </div>
  );
}
