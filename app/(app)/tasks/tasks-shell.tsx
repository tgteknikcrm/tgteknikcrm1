"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/app/page-header";
import { TaskDialog } from "./task-dialog";
import {
  TASK_STATUS_LABEL,
  TASK_STATUS_TONE,
  TASK_PRIORITY_LABEL,
  TASK_PRIORITY_TONE,
  type Job,
  type Machine,
  type Profile,
  type Task,
  type TaskChecklistItem,
  type TaskComment,
  type TaskStatus,
} from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import { setTaskStatus } from "./actions";
import { toast } from "sonner";
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  CalendarDays,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

type View = "kanban" | "list";
type FilterScope = "all" | "mine" | "created" | "overdue" | "today";

const COLUMNS: TaskStatus[] = ["todo", "in_progress", "done", "cancelled"];

function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function initials(s: string | null | undefined): string {
  if (!s) return "?";
  return s
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

interface Props {
  currentUserId: string;
  tasks: Task[];
  people: Array<Pick<Profile, "id" | "full_name" | "phone">>;
  jobs: Pick<Job, "id" | "job_no" | "customer" | "part_name" | "status">[];
  machines: Pick<Machine, "id" | "name">[];
  checklist: TaskChecklistItem[];
  comments: TaskComment[];
}

export function TasksShell({
  currentUserId,
  tasks,
  people,
  jobs,
  machines,
  checklist,
  comments,
}: Props) {
  const router = useRouter();
  const [view, setView] = useState<View>("kanban");
  const [scope, setScope] = useState<FilterScope>("all");
  const [q, setQ] = useState("");
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  // Optimistic status overrides (taskId → status) so the card jumps to
  // the new column instantly on drop. Cleared automatically when the
  // realtime push or the next server render brings the new state.
  const [statusOverrides, setStatusOverrides] = useState<
    Map<string, TaskStatus>
  >(new Map());

  // Realtime: refresh on any task change. Debounced so a burst of
  // updates (drop + status touch + checklist tick) only triggers one
  // server roundtrip instead of three.
  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 250);
    };
    const ch = supabase
      .channel("tasks-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        schedule,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_checklist" },
        schedule,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_comments" },
        schedule,
      )
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(ch);
    };
  }, [router]);

  const peopleMap = useMemo(
    () => new Map(people.map((p) => [p.id, p])),
    [people],
  );

  const today = todayISO();
  // Apply optimistic status overrides on top of server data.
  const tasksWithOverride = useMemo(
    () =>
      tasks.map((t) =>
        statusOverrides.has(t.id)
          ? { ...t, status: statusOverrides.get(t.id)! }
          : t,
      ),
    [tasks, statusOverrides],
  );
  const filtered = useMemo(() => {
    const term = q.trim().toLocaleLowerCase("tr");
    return tasksWithOverride.filter((t) => {
      // scope
      if (scope === "mine" && t.assigned_to !== currentUserId) return false;
      if (scope === "created" && t.created_by !== currentUserId) return false;
      if (
        scope === "overdue" &&
        (!t.due_date || t.due_date >= today || t.status === "done" || t.status === "cancelled")
      )
        return false;
      if (scope === "today" && t.due_date !== today) return false;
      // search
      if (term) {
        const hay = `${t.title} ${t.description ?? ""} ${t.tags.join(" ")}`
          .toLocaleLowerCase("tr");
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [tasksWithOverride, scope, q, today, currentUserId]);

  const tasksByStatus = useMemo(() => {
    const m: Record<TaskStatus, Task[]> = {
      todo: [],
      in_progress: [],
      done: [],
      cancelled: [],
    };
    for (const t of filtered) m[t.status].push(t);
    return m;
  }, [filtered]);

  const checklistByTask = useMemo(() => {
    const m = new Map<string, TaskChecklistItem[]>();
    for (const c of checklist) {
      const arr = m.get(c.task_id) ?? [];
      arr.push(c);
      m.set(c.task_id, arr);
    }
    return m;
  }, [checklist]);

  const commentsByTask = useMemo(() => {
    const m = new Map<string, TaskComment[]>();
    for (const c of comments) {
      const arr = m.get(c.task_id) ?? [];
      arr.push(c);
      m.set(c.task_id, arr);
    }
    return m;
  }, [comments]);

  // Drag handlers — HTML5 drag-and-drop. Lightweight; no library.
  function onDragStart(taskId: string, e: React.DragEvent) {
    setDraggingId(taskId);
    e.dataTransfer.setData("text/plain", taskId);
    e.dataTransfer.effectAllowed = "move";
  }
  function onColumnDragOver(e: React.DragEvent) {
    if (!draggingId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }
  function onColumnDrop(status: TaskStatus, e: React.DragEvent) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || draggingId;
    setDraggingId(null);
    if (!id) return;
    const task = tasks.find((t) => t.id === id);
    if (!task || task.status === status) return;
    // 1. Optimistic — card jumps to the new column on the next paint.
    setStatusOverrides((prev) => {
      const next = new Map(prev);
      next.set(id, status);
      return next;
    });
    // 2. Fire-and-forget — Realtime + the server-side revalidate will
    //    bring the canonical state back; we just clean up the override.
    void setTaskStatus(id, status).then((r) => {
      if (r.error) {
        toast.error(r.error);
        setStatusOverrides((prev) => {
          const next = new Map(prev);
          next.delete(id);
          return next;
        });
        return;
      }
      // Drop the override after a short delay so the realtime row
      // (or next refresh) has time to land. If they collide, the
      // canonical row wins (same value anyway).
      setTimeout(() => {
        setStatusOverrides((prev) => {
          const next = new Map(prev);
          next.delete(id);
          return next;
        });
      }, 1500);
    });
  }

  return (
    <>
      <PageHeader
        title="Görevler"
        description="Atölye için görev tahtası — kanban veya liste görünümü"
        actions={
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="size-4" /> Yeni Görev
          </Button>
        }
      />

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <ViewSwitch view={view} onChange={setView} />
        <ScopeSwitch scope={scope} onChange={setScope} />
        <div className="relative flex-1 max-w-xs ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Görev ara…"
            className="pl-9 h-9"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat
          icon={LayoutGrid}
          label="Aktif"
          value={tasks.filter((t) => t.status === "todo" || t.status === "in_progress").length}
          tone="bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30"
        />
        <Stat
          icon={CheckCircle2}
          label="Tamamlanan"
          value={tasks.filter((t) => t.status === "done").length}
          tone="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
        />
        <Stat
          icon={AlertTriangle}
          label="Geciken"
          value={
            tasks.filter(
              (t) =>
                t.due_date &&
                t.due_date < today &&
                t.status !== "done" &&
                t.status !== "cancelled",
            ).length
          }
          tone="bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30"
        />
        <Stat
          icon={CalendarDays}
          label="Bugünkü"
          value={tasks.filter((t) => t.due_date === today).length}
          tone="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
        />
      </div>

      {view === "kanban" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {COLUMNS.map((col) => {
            const tone = TASK_STATUS_TONE[col];
            const items = tasksByStatus[col];
            return (
              <div
                key={col}
                onDragOver={onColumnDragOver}
                onDrop={(e) => onColumnDrop(col, e)}
                className={cn(
                  "rounded-xl border bg-card flex flex-col min-h-[20rem] transition",
                  draggingId && "ring-1 ring-dashed",
                )}
              >
                <div
                  className={cn(
                    "px-3 py-2 border-b flex items-center justify-between gap-2",
                    tone.bg,
                  )}
                >
                  <div className={cn("flex items-center gap-2", tone.text)}>
                    <span className={cn("size-2 rounded-full", tone.dot)} />
                    <span className="font-bold text-sm">
                      {TASK_STATUS_LABEL[col]}
                    </span>
                  </div>
                  <Badge variant="outline" className="h-5 text-[10px]">
                    {items.length}
                  </Badge>
                </div>
                <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[calc(100vh-22rem)] tg-thin-scroll">
                  {items.length === 0 ? (
                    <div className="text-center text-xs text-muted-foreground py-8">
                      Boş
                    </div>
                  ) : (
                    items.map((t) => (
                      <TaskCard
                        key={t.id}
                        task={t}
                        people={peopleMap}
                        checklist={checklistByTask.get(t.id) ?? []}
                        commentsCount={commentsByTask.get(t.id)?.length ?? 0}
                        onClick={() => setEditTask(t)}
                        onDragStart={(e) => onDragStart(t.id, e)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border bg-card divide-y">
          {filtered.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              Eşleşen görev yok.
            </div>
          ) : (
            filtered.map((t) => (
              <TaskListRow
                key={t.id}
                task={t}
                people={peopleMap}
                checklist={checklistByTask.get(t.id) ?? []}
                commentsCount={commentsByTask.get(t.id)?.length ?? 0}
                onClick={() => setEditTask(t)}
              />
            ))
          )}
        </div>
      )}

      {(createOpen || editTask) && (
        <TaskDialog
          currentUserId={currentUserId}
          people={people}
          jobs={jobs}
          machines={machines}
          task={editTask}
          checklist={editTask ? checklistByTask.get(editTask.id) ?? [] : []}
          comments={editTask ? commentsByTask.get(editTask.id) ?? [] : []}
          open={createOpen || !!editTask}
          onOpenChange={(v) => {
            if (!v) {
              setCreateOpen(false);
              setEditTask(null);
            }
          }}
        />
      )}
    </>
  );
}

/* ───────────────────────────────────────────────────────────────── */

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
      <div className={cn("size-10 rounded-lg flex items-center justify-center border", tone)}>
        <Icon className="size-5" />
      </div>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="text-2xl font-bold tabular-nums leading-tight">{value}</div>
      </div>
    </div>
  );
}

function ViewSwitch({
  view,
  onChange,
}: {
  view: View;
  onChange: (v: View) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border bg-card p-0.5 shadow-sm">
      {(["kanban", "list"] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cn(
            "px-2.5 py-1 rounded-md text-xs font-medium transition flex items-center gap-1.5",
            view === v
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted",
          )}
        >
          {v === "kanban" ? (
            <LayoutGrid className="size-3.5" />
          ) : (
            <List className="size-3.5" />
          )}
          {v === "kanban" ? "Kanban" : "Liste"}
        </button>
      ))}
    </div>
  );
}

function ScopeSwitch({
  scope,
  onChange,
}: {
  scope: FilterScope;
  onChange: (s: FilterScope) => void;
}) {
  const items: { key: FilterScope; label: string }[] = [
    { key: "all", label: "Tümü" },
    { key: "mine", label: "Bana atanan" },
    { key: "created", label: "Oluşturduklarım" },
    { key: "today", label: "Bugün" },
    { key: "overdue", label: "Geciken" },
  ];
  return (
    <div className="inline-flex rounded-lg border bg-card p-0.5 shadow-sm overflow-x-auto">
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          onClick={() => onChange(it.key)}
          className={cn(
            "shrink-0 px-2.5 py-1 rounded-md text-xs font-medium transition",
            scope === it.key
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted",
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

function TaskCard({
  task,
  people,
  checklist,
  commentsCount,
  onClick,
  onDragStart,
}: {
  task: Task;
  people: Map<string, Pick<Profile, "id" | "full_name" | "phone">>;
  checklist: TaskChecklistItem[];
  commentsCount: number;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
}) {
  const today = todayISO();
  const overdue =
    task.due_date &&
    task.due_date < today &&
    task.status !== "done" &&
    task.status !== "cancelled";
  const assignee = task.assigned_to ? people.get(task.assigned_to) : null;
  const priority = TASK_PRIORITY_TONE[task.priority];
  const doneCount = checklist.filter((c) => c.done).length;

  return (
    <button
      type="button"
      onClick={onClick}
      draggable
      onDragStart={onDragStart}
      className={cn(
        "group/card w-full text-left rounded-lg border bg-background p-2.5",
        "hover:shadow-md hover:scale-[1.01] transition cursor-grab active:cursor-grabbing",
        "animate-tg-fade-in",
        overdue && "border-red-500/40",
      )}
    >
      <div className="flex items-start gap-2 mb-1.5">
        <span
          className={cn(
            "size-2 rounded-full mt-1.5 shrink-0",
            priority.bg.replace("/15", ""),
          )}
        />
        <span className="text-sm font-semibold leading-snug line-clamp-2">
          {task.title}
        </span>
      </div>
      {task.description && (
        <p className="text-[11px] text-muted-foreground line-clamp-2 mb-2">
          {task.description}
        </p>
      )}
      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.tags.slice(0, 3).map((t) => (
            <span
              key={t}
              className="px-1.5 h-4 rounded-full text-[9px] font-semibold bg-muted text-muted-foreground"
            >
              {t}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between gap-2 mt-auto">
        <div className="flex items-center gap-1.5">
          {task.due_date && (
            <span
              className={cn(
                "inline-flex items-center gap-1 px-1.5 h-5 rounded-md text-[10px] font-semibold tabular-nums",
                overdue
                  ? "bg-red-500/15 text-red-700 dark:text-red-300"
                  : "bg-muted text-muted-foreground",
              )}
            >
              <CalendarDays className="size-3" />
              {task.due_date.slice(5)}
            </span>
          )}
          {checklist.length > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 h-5 rounded-md text-[10px] font-semibold tabular-nums bg-muted text-muted-foreground">
              <CheckCircle2 className="size-3" />
              {doneCount}/{checklist.length}
            </span>
          )}
          {commentsCount > 0 && (
            <span className="text-[10px] text-muted-foreground">
              💬 {commentsCount}
            </span>
          )}
          <span
            className={cn(
              "px-1.5 h-5 rounded-md text-[10px] font-semibold flex items-center",
              priority.bg,
              priority.text,
            )}
          >
            {TASK_PRIORITY_LABEL[task.priority]}
          </span>
        </div>
        {assignee && (
          <Avatar className="size-6">
            <AvatarFallback className="text-[9px] font-semibold bg-primary/15 text-primary">
              {initials(assignee.full_name || assignee.phone)}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    </button>
  );
}

function TaskListRow({
  task,
  people,
  checklist,
  commentsCount,
  onClick,
}: {
  task: Task;
  people: Map<string, Pick<Profile, "id" | "full_name" | "phone">>;
  checklist: TaskChecklistItem[];
  commentsCount: number;
  onClick: () => void;
}) {
  const tone = TASK_STATUS_TONE[task.status];
  const today = todayISO();
  const overdue =
    task.due_date &&
    task.due_date < today &&
    task.status !== "done" &&
    task.status !== "cancelled";
  const assignee = task.assigned_to ? people.get(task.assigned_to) : null;
  const priority = TASK_PRIORITY_TONE[task.priority];
  const doneCount = checklist.filter((c) => c.done).length;
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition"
    >
      <span className={cn("size-2 rounded-full shrink-0", tone.dot)} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold truncate">{task.title}</span>
          <Badge variant="outline" className={cn("h-4 text-[9px]", tone.bg, tone.text)}>
            {TASK_STATUS_LABEL[task.status]}
          </Badge>
          <Badge variant="outline" className={cn("h-4 text-[9px]", priority.bg, priority.text)}>
            {TASK_PRIORITY_LABEL[task.priority]}
          </Badge>
          {checklist.length > 0 && (
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {doneCount}/{checklist.length}
            </span>
          )}
          {commentsCount > 0 && (
            <span className="text-[10px] text-muted-foreground">💬 {commentsCount}</span>
          )}
        </div>
        {task.description && (
          <div className="text-[11px] text-muted-foreground truncate mt-0.5">
            {task.description}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {task.due_date && (
          <span
            className={cn(
              "text-[11px] tabular-nums px-1.5 py-0.5 rounded",
              overdue
                ? "bg-red-500/15 text-red-700 dark:text-red-300"
                : "text-muted-foreground",
            )}
          >
            {task.due_date}
          </span>
        )}
        {assignee && (
          <Avatar className="size-7">
            <AvatarFallback className="text-[10px] font-semibold bg-primary/15 text-primary">
              {initials(assignee.full_name || assignee.phone)}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    </button>
  );
}
