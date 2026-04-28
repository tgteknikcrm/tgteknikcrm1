"use client";

import { useState, useTransition, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Plus,
  ThumbsUp,
  ThumbsDown,
  MessageCircle,
  Send,
  Trash2,
  Loader2,
  Camera,
  X,
  Wrench as WrenchIcon,
  Sparkles,
  AlertTriangle,
  Hammer,
  Settings as SettingsIcon,
  Eye,
  Hash,
  Activity as ActivityIcon,
  Stamp,
  Factory,
  Users,
  ImagePlus,
  CalendarDays,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  createTimelineEntry,
  deleteTimelineEntry,
  addTimelineComment,
  deleteTimelineComment,
  toggleTimelineReaction,
} from "../timeline-actions";
import {
  TIMELINE_KIND_LABEL,
  timelinePhotoUrl,
  type TimelineEntryKind,
} from "@/lib/supabase/types";
import { cn, formatDateTime } from "@/lib/utils";
import type { TimelineItem, TimelineSource } from "./timeline-data";

interface CommentRow {
  id: string;
  body: string;
  author_id: string | null;
  author_name: string | null;
  created_at: string;
}

type RangeKey = "day" | "week" | "month" | "year" | "all";

const RANGES: { key: RangeKey; label: string; ms?: number }[] = [
  { key: "day", label: "Bugün", ms: 86400000 },
  { key: "week", label: "Bu Hafta", ms: 7 * 86400000 },
  { key: "month", label: "Bu Ay", ms: 30 * 86400000 },
  { key: "year", label: "Bu Yıl", ms: 365 * 86400000 },
  { key: "all", label: "Tümü" },
];

const KIND_META: Record<
  string,
  { icon: LucideIcon; tone: string; label?: string }
> = {
  // Manual kinds
  manuel: { icon: Eye, tone: "bg-zinc-500" },
  bakim: { icon: SettingsIcon, tone: "bg-blue-500" },
  temizlik: { icon: Sparkles, tone: "bg-cyan-500" },
  ariza: { icon: AlertTriangle, tone: "bg-red-500" },
  duzeltme: { icon: WrenchIcon, tone: "bg-violet-500" },
  parca_degisimi: { icon: WrenchIcon, tone: "bg-amber-500" },
  sayim: { icon: Hash, tone: "bg-zinc-500" },
  gozlem: { icon: Eye, tone: "bg-zinc-500" },

  // Production
  production: { icon: Hammer, tone: "bg-emerald-500" },
  production_scrap: { icon: AlertTriangle, tone: "bg-amber-500" },

  // Reviews
  review_onaylandi: { icon: Stamp, tone: "bg-emerald-500" },
  review_reddedildi: { icon: Stamp, tone: "bg-red-500" },
  "review_koşullu": { icon: Stamp, tone: "bg-amber-500" },

  // Activity
  "machine.created": { icon: Factory, tone: "bg-blue-500" },
  "machine.status_changed": { icon: ActivityIcon, tone: "bg-amber-500" },
  "machine.deleted": { icon: Trash2, tone: "bg-red-500" },
  "machine.shift_assigned": { icon: Users, tone: "bg-violet-500" },
};

function kindIcon(kind: string): { icon: LucideIcon; tone: string } {
  return KIND_META[kind] ?? { icon: ActivityIcon, tone: "bg-zinc-500" };
}

function kindLabel(item: TimelineItem): string {
  if (item.source === "manual") {
    return TIMELINE_KIND_LABEL[item.kind as TimelineEntryKind] ?? "Manuel";
  }
  if (item.source === "production") {
    return item.kind === "production_scrap" ? "Üretim · Fire" : "Üretim";
  }
  if (item.source === "review") {
    const status = item.kind.replace("review_", "");
    if (status === "onaylandi") return "Onaylandı";
    if (status === "reddedildi") return "Reddedildi";
    return "Şartlı Onay";
  }
  // activity
  if (item.kind === "machine.status_changed") return "Durum Değişti";
  if (item.kind === "machine.shift_assigned") return "Vardiya Atandı";
  if (item.kind === "machine.created") return "Makine Oluşturuldu";
  if (item.kind === "machine.deleted") return "Makine Silindi";
  return item.kind;
}

interface Props {
  /** machine to scope to. null = global feed across all machines. */
  machineId: string | null;
  items: TimelineItem[];
  comments: Record<string, CommentRow[]>;
  currentUserId: string | null;
  isAdmin: boolean;
  /** Provided in global mode for composer machine selector + filter chip. */
  machines?: { id: string; name: string }[];
}

export function MachineTimeline({
  machineId,
  items,
  comments,
  currentUserId,
  isAdmin,
  machines = [],
}: Props) {
  const [range, setRange] = useState<RangeKey>("week");
  const [composerOpen, setComposerOpen] = useState(false);
  const [machineFilter, setMachineFilter] = useState<string>("all");
  const isGlobal = machineId === null;

  const filtered = useMemo(() => {
    const r = RANGES.find((x) => x.key === range)!;
    let arr = items;
    if (r.ms) {
      const cutoff = Date.now() - r.ms;
      arr = arr.filter((it) => new Date(it.at).getTime() >= cutoff);
    }
    if (isGlobal && machineFilter !== "all") {
      arr = arr.filter((it) => it.machine_id === machineFilter);
    }
    return arr;
  }, [items, range, machineFilter, isGlobal]);

  // Group by day for visual sectioning
  const byDay = useMemo(() => {
    const groups = new Map<string, TimelineItem[]>();
    for (const it of filtered) {
      const d = new Date(it.at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const arr = groups.get(key) ?? [];
      arr.push(it);
      groups.set(key, arr);
    }
    return Array.from(groups.entries());
  }, [filtered]);

  return (
    <section className="mb-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-4 text-muted-foreground" />
          <h2 className="text-base font-semibold tracking-tight">Zaman Çizelgesi</h2>
          <Badge variant="outline" className="font-normal h-5 text-[10px]">
            {filtered.length}
          </Badge>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isGlobal && machines.length > 0 && (
            <Select value={machineFilter} onValueChange={setMachineFilter}>
              <SelectTrigger className="h-7 w-auto min-w-[10rem] text-xs">
                <SelectValue placeholder="Tüm Makineler" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Makineler</SelectItem>
                {machines.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="flex gap-1">
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-medium border transition shrink-0",
                  range === r.key
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground hover:bg-muted",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
          <ComposerDialog
            machineId={machineId}
            machines={machines}
            open={composerOpen}
            onOpenChange={setComposerOpen}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
          Bu aralıkta kayıt yok. Yeni bir not ekleyebilirsin.
        </div>
      ) : (
        <div className="space-y-6">
          {byDay.map(([dayKey, dayItems]) => (
            <DaySection
              key={dayKey}
              dayKey={dayKey}
              items={dayItems}
              comments={comments}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              showMachineChip={isGlobal}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function DaySection({
  dayKey,
  items,
  comments,
  currentUserId,
  isAdmin,
  showMachineChip,
}: {
  dayKey: string;
  items: TimelineItem[];
  comments: Record<string, CommentRow[]>;
  currentUserId: string | null;
  isAdmin: boolean;
  showMachineChip: boolean;
}) {
  const date = new Date(dayKey);
  const dayLabel = date.toLocaleDateString("tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Istanbul",
  });
  const isToday = dayKey === new Date().toISOString().slice(0, 10);

  return (
    <div>
      <div className="flex items-center gap-2 mb-2 sticky top-0 bg-background z-10 py-1">
        <span
          className={cn(
            "text-xs font-bold uppercase tracking-wider",
            isToday ? "text-primary" : "text-muted-foreground",
          )}
        >
          {isToday ? "Bugün · " : ""}
          {dayLabel}
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="relative pl-6 border-l-2 border-border space-y-3">
        {items.map((it) => (
          <TimelineCard
            key={it.id}
            item={it}
            comments={comments[it.manual_entry_id ?? ""] ?? []}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            showMachineChip={showMachineChip}
          />
        ))}
      </div>
    </div>
  );
}

function TimelineCard({
  item,
  comments,
  currentUserId,
  isAdmin,
  showMachineChip,
}: {
  item: TimelineItem;
  comments: CommentRow[];
  currentUserId: string | null;
  isAdmin: boolean;
  showMachineChip: boolean;
}) {
  // Machine context for the actions that need it
  const machineId = item.machine_id ?? "";
  const router = useRouter();
  const meta = kindIcon(item.kind);
  const Icon = meta.icon;
  const [showComments, setShowComments] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [pendingComment, startComment] = useTransition();
  const [pendingReact, startReact] = useTransition();
  const [pendingDelete, startDelete] = useTransition();
  const isManual = item.source === "manual";
  const ownEntry = isManual && currentUserId && item.actor_id === currentUserId;
  const canDeleteEntry = ownEntry || isAdmin;

  function react(kind: "like" | "dislike") {
    if (!isManual || !item.manual_entry_id) return;
    startReact(async () => {
      const r = await toggleTimelineReaction({
        entry_id: item.manual_entry_id!,
        kind,
        machine_id: machineId,
      });
      if (r.error) toast.error(r.error);
      else router.refresh();
    });
  }

  function postComment(e: React.FormEvent) {
    e.preventDefault();
    if (!isManual || !item.manual_entry_id || !commentBody.trim()) return;
    startComment(async () => {
      const r = await addTimelineComment({
        entry_id: item.manual_entry_id!,
        body: commentBody,
        machine_id: machineId,
      });
      if (r.error) toast.error(r.error);
      else {
        setCommentBody("");
        router.refresh();
      }
    });
  }

  function delEntry() {
    if (!item.manual_entry_id) return;
    if (!confirm("Bu kayıt silinsin mi? (Geri alınamaz)")) return;
    startDelete(async () => {
      const r = await deleteTimelineEntry(item.manual_entry_id!, machineId);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Silindi");
        router.refresh();
      }
    });
  }

  function delComment(id: string) {
    if (!confirm("Yorum silinsin mi?")) return;
    startDelete(async () => {
      const r = await deleteTimelineComment(id, machineId);
      if (r.error) toast.error(r.error);
      else router.refresh();
    });
  }

  // Linked job navigation
  const jobId = (item.meta?.job_id as string | undefined) ?? null;

  return (
    <div className="relative">
      {/* Dot on the rail */}
      <span
        className={cn(
          "absolute -left-[27px] top-3 size-3.5 rounded-full border-2 border-background",
          meta.tone,
        )}
      />
      <div className="rounded-lg border bg-card hover:shadow-sm transition">
        {/* Card header */}
        <div className="flex items-start gap-3 px-3 py-2.5">
          <div
            className={cn(
              "size-8 rounded-md flex items-center justify-center shrink-0 text-white",
              meta.tone,
            )}
          >
            <Icon className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold truncate">
                {item.actor_name || "Sistem"}
              </span>
              <Badge variant="outline" className="font-normal h-5 text-[10px]">
                {kindLabel(item)}
              </Badge>
              {showMachineChip && item.machine_id && item.machine_name && (
                <Link
                  href={`/machines/${item.machine_id}`}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30 text-[10px] font-medium hover:bg-blue-500/20"
                >
                  <Factory className="size-2.5" />
                  {item.machine_name}
                </Link>
              )}
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {formatDateTime(item.at)}
              </span>
            </div>
            {item.title && (
              <div className="text-sm font-medium mt-0.5">{item.title}</div>
            )}
            {item.body && (
              <div className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                {item.body}
              </div>
            )}

            {/* Production meta */}
            {item.source === "production" && item.meta && (
              <div className="flex gap-3 mt-1.5 text-[11px] tabular-nums font-mono flex-wrap">
                <span className="text-emerald-700">
                  {String(item.meta.produced)} ÜR
                </span>
                {Number(item.meta.scrap) > 0 && (
                  <span className="text-amber-700">
                    {String(item.meta.scrap)} FİRE
                  </span>
                )}
                {Number(item.meta.downtime) > 0 && (
                  <span className="text-red-700">
                    {String(item.meta.downtime)}dk DURUŞ
                  </span>
                )}
              </div>
            )}

            {/* Photos (manual only) */}
            {item.photos.length > 0 && (
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {item.photos.map((p) => {
                  const url = timelinePhotoUrl(p);
                  if (!url) return null;
                  return (
                    <a
                      key={p}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block size-20 rounded-md border overflow-hidden bg-muted/40 hover:opacity-80 transition"
                    >
                      <Image
                        src={url}
                        alt=""
                        width={80}
                        height={80}
                        className="size-full object-cover"
                      />
                    </a>
                  );
                })}
              </div>
            )}

            {/* Job link */}
            {jobId && (
              <Link
                href={`/quality/${jobId}`}
                className="text-[11px] text-primary hover:underline mt-1 inline-block"
              >
                İşin kalite kontrolüne git →
              </Link>
            )}
          </div>

          {canDeleteEntry && (
            <Button
              variant="ghost"
              size="icon"
              onClick={delEntry}
              disabled={pendingDelete}
              className="size-7 text-muted-foreground hover:text-destructive shrink-0"
              title="Sil"
            >
              {pendingDelete ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
            </Button>
          )}
        </div>

        {/* Reactions / comments toolbar — manual entries only */}
        {isManual && item.manual_entry_id && (
          <div className="border-t px-3 py-1.5 flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => react("like")}
              disabled={pendingReact}
              className={cn(
                "h-7 gap-1.5 text-xs",
                item.user_reaction === "like" && "text-emerald-700 bg-emerald-500/10",
              )}
            >
              <ThumbsUp className="size-3.5" />
              {item.likes ?? 0}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => react("dislike")}
              disabled={pendingReact}
              className={cn(
                "h-7 gap-1.5 text-xs",
                item.user_reaction === "dislike" && "text-red-700 bg-red-500/10",
              )}
            >
              <ThumbsDown className="size-3.5" />
              {item.dislikes ?? 0}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowComments((v) => !v)}
              className="h-7 gap-1.5 text-xs"
            >
              <MessageCircle className="size-3.5" />
              {item.comment_count ?? 0}
            </Button>
          </div>
        )}

        {/* Comments thread */}
        {showComments && isManual && (
          <div className="border-t px-3 py-2 space-y-2 bg-muted/20">
            {comments.length > 0 && (
              <div className="space-y-1.5">
                {comments.map((c) => {
                  const initials = (c.author_name || "?")
                    .split(" ")
                    .map((s) => s[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();
                  const own = currentUserId && c.author_id === currentUserId;
                  return (
                    <div key={c.id} className="flex items-start gap-2">
                      <Avatar className="size-6 shrink-0">
                        <AvatarFallback className="text-[10px] bg-primary/15 text-primary">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="rounded-md bg-card border px-2 py-1.5 text-xs flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">
                            {c.author_name || "—"}
                          </span>
                          <span className="text-[10px] text-muted-foreground tabular-nums">
                            {formatDateTime(c.created_at)}
                          </span>
                          {(own || isAdmin) && (
                            <button
                              onClick={() => delComment(c.id)}
                              className="ml-auto text-muted-foreground hover:text-destructive"
                              title="Sil"
                            >
                              <Trash2 className="size-3" />
                            </button>
                          )}
                        </div>
                        <p className="mt-0.5 whitespace-pre-wrap">{c.body}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <form onSubmit={postComment} className="flex gap-1.5">
              <Input
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                placeholder="Yorum yaz..."
                className="h-8 text-sm"
              />
              <Button
                type="submit"
                size="sm"
                disabled={pendingComment || !commentBody.trim()}
                className="h-8 px-3"
              >
                {pendingComment ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Send className="size-3.5" />
                )}
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */
/* Composer dialog — new manual entry with photos              */
/* ────────────────────────────────────────────────────────── */

const KINDS: TimelineEntryKind[] = [
  "manuel",
  "bakim",
  "temizlik",
  "ariza",
  "duzeltme",
  "parca_degisimi",
  "sayim",
  "gozlem",
];

function ComposerDialog({
  machineId,
  machines,
  open,
  onOpenChange,
}: {
  machineId: string | null;
  machines: { id: string; name: string }[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<TimelineEntryKind>("manuel");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [duration, setDuration] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [pending, startSave] = useTransition();
  const [pickedMachine, setPickedMachine] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  // The machine we'll save under: prop in detail mode, picked in global mode
  const effectiveMachine = machineId ?? pickedMachine;
  const isGlobal = machineId === null;

  function reset() {
    setKind("manuel");
    setTitle("");
    setBody("");
    setDuration("");
    setPhotos([]);
    setPickedMachine("");
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Giriş yapılmamış");
        return;
      }
      const folder = effectiveMachine || "global";
      const uploaded: string[] = [];
      for (const f of files) {
        if (!f.type.startsWith("image/")) {
          toast.error(`'${f.name}' bir görsel değil — atlandı`);
          continue;
        }
        if (f.size > 8 * 1024 * 1024) {
          toast.error(`'${f.name}' 8 MB'dan büyük — atlandı`);
          continue;
        }
        const safe = f.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
        const path = `${user.id}/${folder}/${Date.now()}_${safe}`;
        const { error } = await supabase.storage
          .from("timeline-photos")
          .upload(path, f, { contentType: f.type });
        if (error) {
          toast.error(`'${f.name}' yüklenemedi`);
        } else {
          uploaded.push(path);
        }
      }
      setPhotos((prev) => [...prev, ...uploaded]);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function removePhoto(path: string) {
    setPhotos((prev) => prev.filter((p) => p !== path));
    // Best-effort: remove from storage too
    const supabase = createClient();
    supabase.storage
      .from("timeline-photos")
      .remove([path])
      .catch(() => {});
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!effectiveMachine) {
      toast.error("Önce bir makine seç.");
      return;
    }
    startSave(async () => {
      const r = await createTimelineEntry({
        machine_id: effectiveMachine,
        kind,
        title: title.trim() || undefined,
        body: body.trim() || undefined,
        photo_paths: photos,
        duration_minutes: duration ? Number(duration) : null,
      });
      if (r.error) toast.error(r.error);
      else {
        toast.success("Kayıt eklendi");
        reset();
        onOpenChange(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-7 px-3 gap-1">
          <Plus className="size-3.5" /> Yeni Kayıt
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Yeni Zaman Çizelgesi Kaydı</DialogTitle>
          <DialogDescription>
            Bakım, temizlik, arıza, gözlem... fotoğraf da ekleyebilirsin.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          {isGlobal && (
            <div className="space-y-1.5">
              <Label htmlFor="tl-machine">Makine *</Label>
              <Select value={pickedMachine} onValueChange={setPickedMachine}>
                <SelectTrigger id="tl-machine">
                  <SelectValue placeholder="Makine seç" />
                </SelectTrigger>
                <SelectContent>
                  {machines.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tl-kind">Tip</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as TimelineEntryKind)}>
                <SelectTrigger id="tl-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {TIMELINE_KIND_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tl-duration">Süre (dakika · opsiyonel)</Label>
              <Input
                id="tl-duration"
                type="number"
                min={0}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="ör. 30"
                className="tabular-nums"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tl-title">Başlık (opsiyonel)</Label>
            <Input
              id="tl-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ör. Y ekseni gres bakımı"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tl-body">Açıklama</Label>
            <Textarea
              id="tl-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="Detayları yaz..."
            />
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <Camera className="size-3.5" /> Fotoğraflar
            </Label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={onFileChange}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full"
            >
              {uploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ImagePlus className="size-4" />
              )}
              Fotoğraf Ekle ({photos.length})
            </Button>
            {photos.length > 0 && (
              <div className="flex gap-1.5 flex-wrap mt-1">
                {photos.map((p) => {
                  const url = timelinePhotoUrl(p);
                  return (
                    <div
                      key={p}
                      className="relative size-16 rounded-md border overflow-hidden bg-muted"
                    >
                      {url && (
                        <Image
                          src={url}
                          alt=""
                          width={64}
                          height={64}
                          className="size-full object-cover"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => removePhoto(p)}
                        className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
            >
              İptal
            </Button>
            <Button type="submit" disabled={pending || uploading}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Kaydet
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
