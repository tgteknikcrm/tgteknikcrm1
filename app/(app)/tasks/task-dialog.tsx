"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Trash2,
  Plus,
  X,
  Send,
  Briefcase,
  Factory,
  Users,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import {
  TASK_STATUS_LABEL,
  TASK_PRIORITY_LABEL,
  TASK_PRIORITY_TONE,
  type Job,
  type Machine,
  type Profile,
  type Task,
  type TaskChecklistItem,
  type TaskComment,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/supabase/types";
import { formatPhoneForDisplay } from "@/lib/phone";
import {
  addChecklistItem,
  addTaskComment,
  deleteChecklistItem,
  deleteTask,
  saveTask,
  toggleChecklistItem,
} from "./actions";
import { cn } from "@/lib/utils";

interface Props {
  currentUserId: string;
  people: Array<Pick<Profile, "id" | "full_name" | "phone">>;
  jobs: Pick<Job, "id" | "job_no" | "customer" | "part_name" | "status">[];
  machines: Pick<Machine, "id" | "name">[];
  task: Task | null;
  checklist: TaskChecklistItem[];
  comments: TaskComment[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  // Optimistic create plumbing — only used for the "new task" flow.
  // Lets us close the dialog and drop the temp card into the kanban
  // before the server roundtrip completes.
  onOptimisticCreate?: (task: Task) => void;
  onOptimisticResolve?: (tempId: string, realId: string) => void;
  onOptimisticReject?: (tempId: string) => void;
}

const STATUSES: TaskStatus[] = ["todo", "in_progress", "done", "cancelled"];
const PRIORITIES: TaskPriority[] = ["low", "medium", "high", "urgent"];

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

export function TaskDialog({
  currentUserId,
  people,
  jobs,
  machines,
  task,
  checklist,
  comments,
  open,
  onOpenChange,
  onOptimisticCreate,
  onOptimisticResolve,
  onOptimisticReject,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingMutation, startMutation] = useTransition();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [jobId, setJobId] = useState<string>("");
  const [machineId, setMachineId] = useState<string>("");
  const [tagsText, setTagsText] = useState("");

  const [newChecklistText, setNewChecklistText] = useState("");
  const [commentText, setCommentText] = useState("");

  const peopleMap = new Map(people.map((p) => [p.id, p]));

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setStatus(task.status);
      setPriority(task.priority);
      setDueDate(task.due_date ?? "");
      setAssignedTo(task.assigned_to ?? "");
      setJobId(task.job_id ?? "");
      setMachineId(task.machine_id ?? "");
      setTagsText(task.tags.join(", "));
    } else {
      setTitle("");
      setDescription("");
      setStatus("todo");
      setPriority("medium");
      setDueDate("");
      setAssignedTo("");
      setJobId("");
      setMachineId("");
      setTagsText("");
    }
    setNewChecklistText("");
    setCommentText("");
  }, [task, open]);

  const isCreator = !task || task.created_by === currentUserId;
  const isAssignee = !!task && task.assigned_to === currentUserId;
  const canMutate = isCreator || isAssignee;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error("Başlık gerekli");
      return;
    }
    const tags = tagsText
      .split(/[,\s]+/)
      .map((t) => t.trim())
      .filter(Boolean);

    const payload = {
      id: task?.id,
      title: trimmedTitle,
      description: description || null,
      status,
      priority,
      due_date: dueDate || null,
      assigned_to: assignedTo || null,
      job_id: jobId || null,
      machine_id: machineId || null,
      tags,
    };

    // CREATE flow — optimistic. Drop a temp card into the kanban,
    // close the dialog immediately, persist in the background, then
    // resolve the temp id to the server's real id. The shell's sync
    // effect drops the temp row the moment the real row appears in
    // the server prop. No spinner-and-wait UX.
    if (!task && onOptimisticCreate) {
      const tempId = `temp-${
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : Date.now() + "-" + Math.random().toString(36).slice(2)
      }`;
      const nowIso = new Date().toISOString();
      const optimisticTask: Task = {
        id: tempId,
        title: trimmedTitle,
        description: payload.description,
        status,
        priority,
        due_date: payload.due_date,
        assigned_to: payload.assigned_to,
        job_id: payload.job_id,
        machine_id: payload.machine_id,
        tags,
        created_by: currentUserId,
        completed_at: null,
        created_at: nowIso,
        updated_at: nowIso,
      };
      onOptimisticCreate(optimisticTask);
      onOpenChange(false);
      // Fire-and-forget — UI is already updated.
      void saveTask(payload).then((r) => {
        if ("error" in r && r.error) {
          toast.error(r.error);
          onOptimisticReject?.(tempId);
          return;
        }
        if ("id" in r && r.id) {
          onOptimisticResolve?.(tempId, r.id);
        }
        toast.success("Görev oluşturuldu");
        router.refresh();
      });
      return;
    }

    // EDIT flow — keep the dialog open until the server confirms so
    // the user sees the spinner and can correct on error.
    startTransition(async () => {
      const r = await saveTask(payload);
      if ("error" in r && r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Görev güncellendi");
      onOpenChange(false);
      router.refresh();
    });
  }

  function onDelete() {
    if (!task) return;
    if (!confirm("Bu görev silinsin mi?")) return;
    startTransition(async () => {
      const r = await deleteTask(task.id);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Silindi");
        onOpenChange(false);
        router.refresh();
      }
    });
  }

  function onAddChecklist() {
    if (!task || !newChecklistText.trim()) return;
    const body = newChecklistText.trim();
    setNewChecklistText("");
    startMutation(async () => {
      const r = await addChecklistItem(task.id, body);
      if (r.error) toast.error(r.error);
      router.refresh();
    });
  }

  function onToggleChecklist(id: string, done: boolean) {
    startMutation(async () => {
      const r = await toggleChecklistItem(id, done);
      if (r.error) toast.error(r.error);
      router.refresh();
    });
  }
  function onDeleteChecklist(id: string) {
    startMutation(async () => {
      const r = await deleteChecklistItem(id);
      if (r.error) toast.error(r.error);
      router.refresh();
    });
  }

  function onAddComment() {
    if (!task || !commentText.trim()) return;
    const body = commentText.trim();
    setCommentText("");
    startMutation(async () => {
      const r = await addTaskComment(task.id, body);
      if (r.error) toast.error(r.error);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{task ? "Görev Detayı" : "Yeni Görev"}</DialogTitle>
          <DialogDescription>
            Atama, öncelik, son tarih, alt görevler ve yorumlar.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-12 space-y-1.5">
              <Label htmlFor="t-title">Başlık *</Label>
              <Input
                id="t-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Tezgah-2 yağ değişimi, …"
                disabled={!canMutate}
                required
                autoFocus
              />
            </div>

            <div className="col-span-12 sm:col-span-4 space-y-1.5">
              <Label>Durum</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as TaskStatus)}
                disabled={!canMutate}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {TASK_STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-12 sm:col-span-4 space-y-1.5">
              <Label>Öncelik</Label>
              <div className="grid grid-cols-4 gap-1 rounded-md border p-0.5">
                {PRIORITIES.map((p) => {
                  const tone = TASK_PRIORITY_TONE[p];
                  const active = p === priority;
                  return (
                    <button
                      key={p}
                      type="button"
                      disabled={!canMutate}
                      onClick={() => setPriority(p)}
                      className={cn(
                        "px-1 py-1 rounded text-xs font-medium transition",
                        active
                          ? `${tone.bg} ${tone.text} ring-2 ${tone.ring}`
                          : "text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {TASK_PRIORITY_LABEL[p]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="col-span-12 sm:col-span-4 space-y-1.5">
              <Label htmlFor="t-due">Son Tarih</Label>
              <Input
                id="t-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={!canMutate}
              />
            </div>

            <div className="col-span-12 sm:col-span-6 space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Users className="size-3.5" /> Atanan Kişi
              </Label>
              <Select
                value={assignedTo || "none"}
                onValueChange={(v) => setAssignedTo(v === "none" ? "" : v)}
                disabled={!canMutate}
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Atanmadı —</SelectItem>
                  {people.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name || formatPhoneForDisplay(p.phone) || "—"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {assignedTo && (
                <div className="flex items-center gap-2 mt-1.5">
                  <Avatar className="size-6">
                    <AvatarFallback className="text-[9px] font-semibold bg-primary/15 text-primary">
                      {initials(
                        peopleMap.get(assignedTo)?.full_name ||
                          peopleMap.get(assignedTo)?.phone,
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-[11px] text-muted-foreground">
                    {peopleMap.get(assignedTo)?.full_name ||
                      formatPhoneForDisplay(
                        peopleMap.get(assignedTo)?.phone ?? null,
                      )}
                  </span>
                </div>
              )}
            </div>

            <div className="col-span-12 sm:col-span-3 space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Briefcase className="size-3.5" /> İş
              </Label>
              <Select
                value={jobId || "none"}
                onValueChange={(v) => setJobId(v === "none" ? "" : v)}
                disabled={!canMutate}
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Yok —</SelectItem>
                  {jobs.map((j) => (
                    <SelectItem key={j.id} value={j.id}>
                      {j.job_no ? `${j.job_no} · ` : ""}
                      {j.customer}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-12 sm:col-span-3 space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Factory className="size-3.5" /> Makine
              </Label>
              <Select
                value={machineId || "none"}
                onValueChange={(v) => setMachineId(v === "none" ? "" : v)}
                disabled={!canMutate}
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Yok —</SelectItem>
                  {machines.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-12 space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Tag className="size-3.5" /> Etiketler
              </Label>
              <Input
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
                placeholder="bakım, acil, müşteri (virgülle ayır)"
                disabled={!canMutate}
              />
            </div>

            <div className="col-span-12 space-y-1.5">
              <Label htmlFor="t-desc">Açıklama</Label>
              <Textarea
                id="t-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Detaylar, prosedürler, hatırlatmalar…"
                disabled={!canMutate}
              />
            </div>
          </div>

          {/* Checklist (only available for existing tasks) */}
          {task && (
            <div className="rounded-lg border p-3 space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Alt Görevler ({checklist.filter((c) => c.done).length}/
                {checklist.length})
              </Label>
              <div className="space-y-1">
                {checklist.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-2 group/item"
                  >
                    <Checkbox
                      checked={c.done}
                      onCheckedChange={(v) =>
                        onToggleChecklist(c.id, v === true)
                      }
                      disabled={!canMutate || pendingMutation}
                    />
                    <span
                      className={cn(
                        "text-sm flex-1",
                        c.done && "line-through text-muted-foreground",
                      )}
                    >
                      {c.body}
                    </span>
                    {canMutate && (
                      <button
                        type="button"
                        onClick={() => onDeleteChecklist(c.id)}
                        disabled={pendingMutation}
                        className="opacity-0 group-hover/item:opacity-100 transition text-muted-foreground hover:text-red-600"
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {canMutate && (
                <div className="flex gap-2">
                  <Input
                    value={newChecklistText}
                    onChange={(e) => setNewChecklistText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        onAddChecklist();
                      }
                    }}
                    placeholder="Yeni alt görev…"
                    className="h-8 text-sm"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={onAddChecklist}
                    disabled={pendingMutation || !newChecklistText.trim()}
                    className="h-8"
                  >
                    <Plus className="size-3.5" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Comments */}
          {task && (
            <div className="rounded-lg border p-3 space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Yorumlar ({comments.length})
              </Label>
              <div className="space-y-2 max-h-48 overflow-y-auto tg-thin-scroll">
                {comments.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    Henüz yorum yok.
                  </p>
                ) : (
                  comments.map((c) => {
                    const author = c.author_id ? peopleMap.get(c.author_id) : null;
                    return (
                      <div key={c.id} className="flex gap-2">
                        <Avatar className="size-7 shrink-0">
                          <AvatarFallback className="text-[9px] font-semibold bg-primary/15 text-primary">
                            {initials(
                              author?.full_name || author?.phone,
                            )}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-semibold">
                            {author?.full_name ||
                              formatPhoneForDisplay(author?.phone ?? null) ||
                              "Kullanıcı"}
                            <span className="text-muted-foreground font-normal ml-1.5">
                              {new Date(c.created_at).toLocaleString("tr-TR", {
                                hour: "2-digit",
                                minute: "2-digit",
                                day: "2-digit",
                                month: "short",
                              })}
                            </span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">
                            {c.body}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      onAddComment();
                    }
                  }}
                  placeholder="Yorum ekle…"
                  className="h-8 text-sm"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={onAddComment}
                  disabled={pendingMutation || !commentText.trim()}
                  className="h-8 px-2.5"
                >
                  <Send className="size-3.5" />
                </Button>
              </div>
            </div>
          )}

          <DialogFooter className="flex-row !justify-between gap-2">
            {task && isCreator && (
              <Button
                type="button"
                variant="ghost"
                onClick={onDelete}
                disabled={pending}
                className="text-red-600 hover:text-red-600 hover:bg-red-500/10"
              >
                <Trash2 className="size-4" /> Sil
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Kapat
              </Button>
              {canMutate && (
                <Button type="submit" disabled={pending}>
                  {pending && <Loader2 className="size-4 animate-spin" />}
                  {task ? "Kaydet" : "Oluştur"}
                </Button>
              )}
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
