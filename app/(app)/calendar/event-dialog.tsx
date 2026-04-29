"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
  Search,
  Check,
  X,
  Clock,
  MapPin,
  Briefcase,
  Factory,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  CALENDAR_ATTENDEE_LABEL,
  CALENDAR_COLOR_MAP,
  type CalendarAttendeeStatus,
  type CalendarEvent,
  type CalendarEventAttendee,
  type CalendarEventColor,
  type Job,
  type Machine,
  type Profile,
} from "@/lib/supabase/types";
import { formatPhoneForDisplay } from "@/lib/phone";
import {
  deleteCalendarEvent,
  saveCalendarEvent,
  setAttendeeStatus,
} from "./actions";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface Props {
  trigger: React.ReactNode;
  currentUserId: string;
  people: Array<Pick<Profile, "id" | "full_name" | "phone">>;
  jobs: Pick<Job, "id" | "job_no" | "customer" | "part_name" | "status">[];
  machines: Pick<Machine, "id" | "name">[];
  event: CalendarEvent | null;
  prefill: { starts_at: string; ends_at: string; all_day: boolean } | null;
  onClose: () => void;
}

const COLORS: CalendarEventColor[] = [
  "blue",
  "cyan",
  "green",
  "amber",
  "orange",
  "red",
  "pink",
  "violet",
  "gray",
];

function isoLocalNow(offsetMin = 0): string {
  const d = new Date(Date.now() + offsetMin * 60_000);
  // Returns YYYY-MM-DDTHH:mm in local-ish format suitable for datetime-local
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function toDateOnly(iso: string): string {
  return iso.slice(0, 10);
}
function fromInputToISO(local: string): string {
  // datetime-local has no timezone. Treat as local TR time.
  return new Date(local).toISOString();
}
function dateOnlyToISOAtStart(date: string): string {
  return new Date(`${date}T00:00:00`).toISOString();
}
function dateOnlyToISOAtEnd(date: string): string {
  return new Date(`${date}T23:59:59`).toISOString();
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

export function EventDialog({
  trigger,
  currentUserId,
  people,
  jobs,
  machines,
  event,
  prefill,
  onClose,
}: Props) {
  const isOpen = event !== null || prefill !== null;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isOpen || internalOpen;

  const [pending, startTransition] = useTransition();

  // Form state — re-initialized whenever event/prefill changes.
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [startsLocal, setStartsLocal] = useState("");
  const [endsLocal, setEndsLocal] = useState("");
  const [startsDate, setStartsDate] = useState("");
  const [endsDate, setEndsDate] = useState("");
  const [color, setColor] = useState<CalendarEventColor>("blue");
  const [jobId, setJobId] = useState<string>("");
  const [machineId, setMachineId] = useState<string>("");
  const [attendeeIds, setAttendeeIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  // Live attendees (for the read-only event detail view)
  const [liveAttendees, setLiveAttendees] = useState<CalendarEventAttendee[]>([]);

  useEffect(() => {
    if (event) {
      setTitle(event.title);
      setDescription(event.description ?? "");
      setLocation(event.location ?? "");
      setAllDay(event.all_day);
      setColor(event.color);
      setJobId(event.job_id ?? "");
      setMachineId(event.machine_id ?? "");
      if (event.all_day) {
        setStartsDate(toDateOnly(event.starts_at));
        setEndsDate(toDateOnly(event.ends_at));
      } else {
        setStartsLocal(toDatetimeLocal(event.starts_at));
        setEndsLocal(toDatetimeLocal(event.ends_at));
      }
      // Fetch existing attendees
      const supabase = createClient();
      void supabase
        .from("calendar_event_attendees")
        .select("*")
        .eq("event_id", event.id)
        .then(({ data }) => {
          const rows = (data ?? []) as CalendarEventAttendee[];
          setLiveAttendees(rows);
          setAttendeeIds(
            new Set(
              rows
                .filter((a) => a.user_id !== currentUserId)
                .map((a) => a.user_id),
            ),
          );
        });
    } else if (prefill) {
      setTitle("");
      setDescription("");
      setLocation("");
      setAllDay(prefill.all_day);
      setColor("blue");
      setJobId("");
      setMachineId("");
      setAttendeeIds(new Set());
      setLiveAttendees([]);
      if (prefill.all_day) {
        setStartsDate(prefill.starts_at.slice(0, 10));
        setEndsDate(prefill.ends_at.slice(0, 10));
      } else {
        setStartsLocal(toDatetimeLocal(prefill.starts_at));
        setEndsLocal(toDatetimeLocal(prefill.ends_at));
      }
    }
  }, [event, prefill, currentUserId]);

  function handleClose(v: boolean) {
    setInternalOpen(v);
    if (!v) onClose();
  }

  const isCreator = !event || event.created_by === currentUserId;
  const myStatus =
    event &&
    (liveAttendees.find((a) => a.user_id === currentUserId)?.status ?? null);

  const candidates = useMemo(
    () => people.filter((p) => p.id !== currentUserId),
    [people, currentUserId],
  );
  const filteredCands = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("tr");
    if (!term) return candidates;
    return candidates.filter((c) =>
      `${c.full_name ?? ""} ${c.phone ?? ""}`
        .toLocaleLowerCase("tr")
        .includes(term),
    );
  }, [candidates, search]);

  function toggleAttendee(id: string) {
    setAttendeeIds((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Başlık gerekli");
      return;
    }

    let startsISO: string;
    let endsISO: string;
    if (allDay) {
      if (!startsDate || !endsDate) {
        toast.error("Tarihler gerekli");
        return;
      }
      startsISO = dateOnlyToISOAtStart(startsDate);
      endsISO = dateOnlyToISOAtEnd(endsDate);
    } else {
      if (!startsLocal || !endsLocal) {
        toast.error("Başlangıç ve bitiş gerekli");
        return;
      }
      startsISO = fromInputToISO(startsLocal);
      endsISO = fromInputToISO(endsLocal);
    }

    startTransition(async () => {
      const r = await saveCalendarEvent({
        id: event?.id,
        title,
        description: description || null,
        location: location || null,
        starts_at: startsISO,
        ends_at: endsISO,
        all_day: allDay,
        color,
        job_id: jobId || null,
        machine_id: machineId || null,
        attendee_ids: Array.from(attendeeIds),
      });
      if ("error" in r && r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(event ? "Etkinlik güncellendi" : "Etkinlik oluşturuldu");
      handleClose(false);
    });
  }

  function onDelete() {
    if (!event) return;
    if (!confirm("Bu etkinlik silinsin mi?")) return;
    startTransition(async () => {
      const r = await deleteCalendarEvent(event.id);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Silindi");
        handleClose(false);
      }
    });
  }

  function onRsvp(s: CalendarAttendeeStatus) {
    if (!event) return;
    startTransition(async () => {
      const r = await setAttendeeStatus(event.id, s);
      if (r.error) toast.error(r.error);
      else {
        toast.success(`Cevap: ${CALENDAR_ATTENDEE_LABEL[s]}`);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild onClick={() => setInternalOpen(true)}>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {event ? "Etkinliği Düzenle" : "Yeni Etkinlik"}
          </DialogTitle>
          <DialogDescription>
            Tarih, katılımcı ve renk seç. Yeni etkinlik herkesin takvimine
            düşer ve onay/red yanıtı alabilir.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ev-title">Başlık *</Label>
            <Input
              id="ev-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Tezgah bakımı, müşteri görüşmesi…"
              disabled={!isCreator}
              required
              autoFocus
            />
          </div>

          {/* All-day toggle */}
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={allDay}
              onCheckedChange={(v) => setAllDay(v === true)}
              disabled={!isCreator}
            />
            <span>Tüm gün</span>
          </label>

          {/* Date/time pickers */}
          {allDay ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Başlangıç</Label>
                <Input
                  type="date"
                  value={startsDate}
                  onChange={(e) => setStartsDate(e.target.value)}
                  disabled={!isCreator}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Bitiş</Label>
                <Input
                  type="date"
                  value={endsDate}
                  onChange={(e) => setEndsDate(e.target.value)}
                  disabled={!isCreator}
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Başlangıç</Label>
                <Input
                  type="datetime-local"
                  value={startsLocal}
                  onChange={(e) => setStartsLocal(e.target.value)}
                  disabled={!isCreator}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Bitiş</Label>
                <Input
                  type="datetime-local"
                  value={endsLocal}
                  onChange={(e) => setEndsLocal(e.target.value)}
                  disabled={!isCreator}
                />
              </div>
            </div>
          )}

          {/* Color */}
          <div className="space-y-1.5">
            <Label className="text-xs">Renk</Label>
            <div className="flex flex-wrap gap-1.5">
              {COLORS.map((c) => {
                const tone = CALENDAR_COLOR_MAP[c];
                const active = c === color;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    disabled={!isCreator}
                    className={cn(
                      "size-7 rounded-full border-2 transition flex items-center justify-center",
                      tone.bg,
                      active
                        ? "ring-2 ring-primary scale-110 border-white"
                        : "border-transparent hover:scale-110",
                    )}
                    title={tone.name}
                  >
                    {active && (
                      <Check className="size-3.5 text-white drop-shadow" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Location */}
          <div className="space-y-1.5">
            <Label htmlFor="ev-loc" className="flex items-center gap-1.5">
              <MapPin className="size-3.5" /> Konum
            </Label>
            <Input
              id="ev-loc"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Atölye, toplantı odası, müşteri lokasyonu…"
              disabled={!isCreator}
            />
          </div>

          {/* Linked job + machine */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Briefcase className="size-3.5" /> İş (opsiyonel)
              </Label>
              <Select
                value={jobId || "none"}
                onValueChange={(v) => setJobId(v === "none" ? "" : v)}
                disabled={!isCreator}
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Yok —</SelectItem>
                  {jobs.map((j) => (
                    <SelectItem key={j.id} value={j.id}>
                      {j.job_no ? `${j.job_no} · ` : ""}
                      {j.customer} – {j.part_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Factory className="size-3.5" /> Makine (opsiyonel)
              </Label>
              <Select
                value={machineId || "none"}
                onValueChange={(v) =>
                  setMachineId(v === "none" ? "" : v)
                }
                disabled={!isCreator}
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
          </div>

          {/* Attendees */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5">
                <Users className="size-3.5" /> Katılımcılar ({attendeeIds.size})
              </Label>
              {attendeeIds.size > 0 && isCreator && (
                <button
                  type="button"
                  onClick={() => setAttendeeIds(new Set())}
                  className="text-[11px] text-muted-foreground hover:underline"
                >
                  Temizle
                </button>
              )}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Kişi ara…"
                className="pl-9 h-9"
                disabled={!isCreator}
              />
            </div>
            <div className="rounded-md border max-h-44 overflow-y-auto divide-y">
              {filteredCands.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  Eşleşen kişi yok.
                </div>
              ) : (
                filteredCands.map((p) => {
                  const checked = attendeeIds.has(p.id);
                  const att = liveAttendees.find((a) => a.user_id === p.id);
                  return (
                    <label
                      key={p.id}
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-2 cursor-pointer",
                        "hover:bg-muted/60 transition",
                        checked && "bg-primary/5",
                        !isCreator && "cursor-default",
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleAttendee(p.id)}
                        disabled={!isCreator}
                      />
                      <Avatar className="size-7">
                        <AvatarFallback className="text-[10px] font-semibold bg-primary/15 text-primary">
                          {initials(p.full_name || p.phone)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">
                          {p.full_name || formatPhoneForDisplay(p.phone) || "—"}
                        </div>
                        {att && (
                          <Badge
                            variant="outline"
                            className="h-4 text-[9px] mt-0.5"
                          >
                            {CALENDAR_ATTENDEE_LABEL[att.status]}
                          </Badge>
                        )}
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="ev-desc">Notlar</Label>
            <Textarea
              id="ev-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Detay, gündem, hatırlatma…"
              disabled={!isCreator}
            />
          </div>

          {/* RSVP for non-creator attendees */}
          {event && !isCreator && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Clock className="size-3.5" /> Yanıtın
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(["accepted", "tentative", "declined"] as const).map((s) => (
                  <Button
                    key={s}
                    type="button"
                    variant={myStatus === s ? "default" : "outline"}
                    size="sm"
                    onClick={() => onRsvp(s)}
                    disabled={pending}
                  >
                    {CALENDAR_ATTENDEE_LABEL[s]}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <DialogFooter className="flex-row !justify-between gap-2">
            {event && isCreator && (
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
                onClick={() => handleClose(false)}
              >
                <X className="size-4" /> Kapat
              </Button>
              {isCreator && (
                <Button type="submit" disabled={pending}>
                  {pending && <Loader2 className="size-4 animate-spin" />}
                  {event ? "Kaydet" : "Oluştur"}
                </Button>
              )}
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
