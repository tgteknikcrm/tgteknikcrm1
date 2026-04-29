import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import { TasksShell } from "./tasks-shell";
import type {
  Job,
  Machine,
  Profile,
  Task,
  TaskChecklistItem,
  TaskComment,
} from "@/lib/supabase/types";

export const metadata = { title: "Görevler" };

export default async function TasksPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const [tRes, peopleRes, jRes, mRes, cRes, cmRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("*")
      .order("status", { ascending: true })
      .order("priority", { ascending: false })
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, full_name, phone")
      .eq("active", true)
      .order("full_name"),
    supabase
      .from("jobs")
      .select("id, job_no, customer, part_name, status")
      .in("status", ["beklemede", "uretimde"])
      .order("created_at", { ascending: false })
      .limit(80),
    supabase.from("machines").select("id, name").order("name"),
    supabase.from("task_checklist").select("*").order("position"),
    supabase
      .from("task_comments")
      .select("*")
      .order("created_at", { ascending: true }),
  ]);

  const tasks = (tRes.data ?? []) as Task[];
  const people = (peopleRes.data ?? []) as Array<
    Pick<Profile, "id" | "full_name" | "phone">
  >;
  const jobs = (jRes.data ?? []) as Pick<
    Job,
    "id" | "job_no" | "customer" | "part_name" | "status"
  >[];
  const machines = (mRes.data ?? []) as Pick<Machine, "id" | "name">[];
  const checklist = (cRes.data ?? []) as TaskChecklistItem[];
  const comments = (cmRes.data ?? []) as TaskComment[];

  return (
    <TasksShell
      currentUserId={profile.id}
      tasks={tasks}
      people={people}
      jobs={jobs}
      machines={machines}
      checklist={checklist}
      comments={comments}
    />
  );
}
