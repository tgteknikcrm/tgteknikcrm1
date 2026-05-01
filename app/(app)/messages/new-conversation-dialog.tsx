"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Loader2, Search, Check, MessageSquarePlus, Users, X } from "lucide-react";
import {
  CONVERSATION_COLOR_PRESETS,
  type Conversation,
  type ConversationParticipant,
  type Profile,
} from "@/lib/supabase/types";
import {
  createGroupConversation,
  getOrCreateDirectConversation,
} from "./actions";
import { formatPhoneForDisplay } from "@/lib/phone";
import { cn } from "@/lib/utils";

interface Props {
  trigger: React.ReactNode;
  currentUserId: string;
  people: Array<Pick<Profile, "id" | "full_name" | "phone">>;
  // Optional callback invoked after a conversation is successfully
  // created. When provided, the parent fully owns the post-create
  // flow (merging into client state + selecting it). The dialog
  // skips its own router.push/refresh in that case so we don't
  // race against the parent's state mutation.
  //
  // The bundle (canonical conversation row + participants) is read
  // by the server action right after the insert and forwarded here.
  // The parent uses it to seed local state synchronously — no extra
  // client-side fetch, no F5 needed for the chat panel to appear.
  onCreated?: (
    convId: string,
    bundle?: {
      conversation: Conversation | null;
      participants: ConversationParticipant[];
    },
  ) => void | Promise<void>;
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

/**
 * Modern messenger-style new-conversation flow:
 *   1. User clicks a person → SELECT (visual only, no server call yet)
 *   2. User clicks "Sohbeti Başlat" → loading overlay → server creates
 *      conversation atomically → navigate
 *   3. If anything fails, inline error stays in the dialog (user doesn't
 *      lose their selection or tab state)
 *
 * Group tab uses the same select-then-confirm pattern with multi-select.
 */
export function NewConversationDialog({
  trigger,
  currentUserId,
  people,
  onCreated,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"direct" | "group">("direct");
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Direct: single selection (radio behavior)
  const [selectedDirectId, setSelectedDirectId] = useState<string | null>(null);

  // Group form state
  const [title, setTitle] = useState("");
  const [color, setColor] = useState(CONVERSATION_COLOR_PRESETS[0].hex);
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());

  const candidates = useMemo(
    () => people.filter((p) => p.id !== currentUserId),
    [people, currentUserId],
  );

  const filteredCandidates = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("tr");
    if (!term) return candidates;
    return candidates.filter((c) =>
      `${c.full_name ?? ""} ${c.phone ?? ""}`
        .toLocaleLowerCase("tr")
        .includes(term),
    );
  }, [candidates, search]);

  const selectedDirectPerson = useMemo(
    () => candidates.find((p) => p.id === selectedDirectId) ?? null,
    [candidates, selectedDirectId],
  );

  function reset() {
    setTab("direct");
    setSearch("");
    setError(null);
    setSelectedDirectId(null);
    setTitle("");
    setColor(CONVERSATION_COLOR_PRESETS[0].hex);
    setMemberIds(new Set());
  }

  // Clear inline errors as soon as the user changes anything that might
  // resolve them — prevents stale error banners.
  useEffect(() => {
    if (error) setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, selectedDirectId, memberIds, title]);

  function toggleMember(id: string) {
    setMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function startDirect() {
    if (!selectedDirectId) return;
    setError(null);
    startTransition(async () => {
      const r = await getOrCreateDirectConversation(selectedDirectId);
      if ("error" in r && r.error) {
        setError(r.error);
        toast.error(r.error);
        return;
      }
      const id = "id" in r ? r.id : null;
      if (!id) {
        const msg = "Konuşma oluşturulamadı (id dönmedi)";
        setError(msg);
        toast.error(msg);
        return;
      }
      // Success — close dialog, hand the new id + canonical bundle to
      // the parent. With the bundle, the parent updates local state
      // synchronously and opens the chat panel without waiting for a
      // refresh round-trip.
      setOpen(false);
      reset();
      if (onCreated) {
        const conv =
          "conversation" in r ? r.conversation ?? null : null;
        const parts =
          "participants" in r ? r.participants ?? [] : [];
        await onCreated(id, { conversation: conv, participants: parts });
      } else {
        router.push(`/messages?c=${id}`);
        router.refresh();
      }
    });
  }

  function startGroup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      const msg = "Grup adı gerekli";
      setError(msg);
      toast.error(msg);
      return;
    }
    if (memberIds.size === 0) {
      const msg = "En az bir üye seç";
      setError(msg);
      toast.error(msg);
      return;
    }
    startTransition(async () => {
      const r = await createGroupConversation({
        title,
        color,
        memberIds: Array.from(memberIds),
      });
      if ("error" in r && r.error) {
        setError(r.error);
        toast.error(r.error);
        return;
      }
      const id = "id" in r ? r.id : null;
      if (!id) {
        const msg = "Grup oluşturulamadı (id dönmedi)";
        setError(msg);
        toast.error(msg);
        return;
      }
      setOpen(false);
      reset();
      toast.success("Grup oluşturuldu");
      if (onCreated) {
        const conv =
          "conversation" in r ? r.conversation ?? null : null;
        const parts =
          "participants" in r ? r.participants ?? [] : [];
        await onCreated(id, { conversation: conv, participants: parts });
      } else {
        router.push(`/messages?c=${id}`);
        router.refresh();
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (pending) return; // prevent close mid-flight
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg overflow-hidden p-0">
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2">
            <MessageSquarePlus className="size-5 text-primary" />
            Yeni Mesajlaşma
          </DialogTitle>
          <DialogDescription>
            Birebir konuşma başlat ya da grup oluştur.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          {/* Loading overlay — covers the whole dialog body so the user
              can't click anything else while the server is working. */}
          {pending && (
            <div
              className="absolute inset-0 z-30 bg-background/85 backdrop-blur-sm flex items-center justify-center animate-tg-fade-in"
              aria-live="polite"
            >
              <div className="flex flex-col items-center gap-3 text-center">
                <Loader2 className="size-8 animate-spin text-primary" />
                <div className="text-sm font-semibold">
                  {tab === "direct"
                    ? "Sohbet hazırlanıyor…"
                    : "Grup oluşturuluyor…"}
                </div>
                <div className="text-[11px] text-muted-foreground max-w-[260px]">
                  Bir saniye, katılımcılar ekleniyor ve konuşma açılıyor.
                </div>
              </div>
            </div>
          )}

          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as "direct" | "group")}
            className="flex flex-col"
          >
            <div className="px-5 pt-3">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="direct" className="gap-1.5">
                  <MessageSquarePlus className="size-3.5" /> Birebir
                </TabsTrigger>
                <TabsTrigger value="group" className="gap-1.5">
                  <Users className="size-3.5" /> Grup
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Direct tab — select then start */}
            <TabsContent
              value="direct"
              className="space-y-3 m-0 p-5 pt-3 data-[state=inactive]:hidden"
            >
              {/* Selected preview chip */}
              {selectedDirectPerson && (
                <div className="flex items-center gap-2 rounded-full border-2 border-primary/30 bg-primary/5 pl-1 pr-1 py-1 animate-tg-fade-in">
                  <Avatar className="size-7">
                    <AvatarFallback className="text-[10px] font-bold bg-primary/15 text-primary">
                      {initials(
                        selectedDirectPerson.full_name ||
                          selectedDirectPerson.phone,
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 text-xs">
                    <span className="font-semibold">
                      {selectedDirectPerson.full_name ||
                        formatPhoneForDisplay(selectedDirectPerson.phone) ||
                        "—"}
                    </span>
                    <span className="text-muted-foreground ml-1.5 font-mono">
                      {selectedDirectPerson.full_name &&
                        formatPhoneForDisplay(selectedDirectPerson.phone)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedDirectId(null)}
                    className="size-6 rounded-full hover:bg-muted flex items-center justify-center transition"
                    aria-label="Seçimi kaldır"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              )}

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="İsim veya telefon ara…"
                  className="pl-9 h-9"
                  autoFocus
                />
              </div>

              <div className="rounded-md border max-h-72 overflow-y-auto divide-y bg-background">
                {filteredCandidates.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    Eşleşen kişi yok.
                  </div>
                ) : (
                  filteredCandidates.map((p) => {
                    const isSelected = selectedDirectId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() =>
                          setSelectedDirectId(isSelected ? null : p.id)
                        }
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 text-left transition",
                          "hover:bg-muted/60",
                          isSelected &&
                            "bg-primary/5 ring-2 ring-primary/40 ring-inset",
                        )}
                      >
                        <Avatar className="size-9">
                          <AvatarFallback
                            className={cn(
                              "text-xs font-semibold",
                              isSelected
                                ? "bg-primary text-primary-foreground"
                                : "bg-primary/15 text-primary",
                            )}
                          >
                            {initials(p.full_name || p.phone)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold truncate">
                            {p.full_name ||
                              formatPhoneForDisplay(p.phone) ||
                              "—"}
                          </div>
                          <div className="text-[11px] text-muted-foreground font-mono truncate">
                            {formatPhoneForDisplay(p.phone)}
                          </div>
                        </div>
                        <div
                          className={cn(
                            "size-5 rounded-full border-2 flex items-center justify-center transition shrink-0",
                            isSelected
                              ? "border-primary bg-primary"
                              : "border-muted-foreground/30",
                          )}
                        >
                          {isSelected && (
                            <Check className="size-3 text-primary-foreground" />
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {error && tab === "direct" && (
                <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300 animate-tg-fade-in">
                  {error}
                </div>
              )}

              <DialogFooter className="gap-2 sm:gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  İptal
                </Button>
                <Button
                  type="button"
                  onClick={startDirect}
                  disabled={!selectedDirectId || pending}
                  className="gap-1.5"
                >
                  <MessageSquarePlus className="size-4" />
                  Sohbeti Başlat
                </Button>
              </DialogFooter>
            </TabsContent>

            {/* Group tab */}
            <TabsContent
              value="group"
              className="m-0 p-5 pt-3 data-[state=inactive]:hidden"
            >
              <form onSubmit={startGroup} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="g-title">Grup Adı</Label>
                  <Input
                    id="g-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Vardiya operatörleri, Tornaadama, …"
                    maxLength={80}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Renk</Label>
                  <div className="flex flex-wrap gap-2">
                    {CONVERSATION_COLOR_PRESETS.map((p) => {
                      const active = color === p.hex;
                      return (
                        <button
                          key={p.hex}
                          type="button"
                          onClick={() => setColor(p.hex)}
                          className={cn(
                            "size-7 rounded-full border-2 flex items-center justify-center transition",
                            active
                              ? "ring-2 ring-primary scale-110 border-white"
                              : "border-transparent hover:scale-110",
                          )}
                          style={{ backgroundColor: p.hex }}
                          title={p.name}
                        >
                          {active && (
                            <Check className="size-3 text-white drop-shadow" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">
                      Üyeler ({memberIds.size} seçili)
                    </Label>
                    {memberIds.size > 0 && (
                      <button
                        type="button"
                        onClick={() => setMemberIds(new Set())}
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
                    />
                  </div>
                  <div className="rounded-md border max-h-56 overflow-y-auto divide-y bg-background">
                    {filteredCandidates.length === 0 ? (
                      <div className="p-6 text-center text-sm text-muted-foreground">
                        Eşleşen kişi yok.
                      </div>
                    ) : (
                      filteredCandidates.map((p) => {
                        const checked = memberIds.has(p.id);
                        return (
                          <label
                            key={p.id}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2 cursor-pointer transition",
                              "hover:bg-muted/60",
                              checked && "bg-primary/5",
                            )}
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => toggleMember(p.id)}
                            />
                            <Avatar className="size-7">
                              <AvatarFallback className="text-[10px] font-semibold bg-primary/15 text-primary">
                                {initials(p.full_name || p.phone)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium truncate">
                                {p.full_name ||
                                  formatPhoneForDisplay(p.phone) ||
                                  "—"}
                              </div>
                              <div className="text-[10px] text-muted-foreground font-mono truncate">
                                {formatPhoneForDisplay(p.phone)}
                              </div>
                            </div>
                            {checked && (
                              <Check className="size-4 text-primary shrink-0" />
                            )}
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>

                {error && tab === "group" && (
                  <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300 animate-tg-fade-in">
                    {error}
                  </div>
                )}

                <DialogFooter className="gap-2 sm:gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                  >
                    İptal
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      !title.trim() || memberIds.size === 0 || pending
                    }
                    className="gap-1.5"
                  >
                    <Users className="size-4" />
                    Grubu Oluştur
                  </Button>
                </DialogFooter>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
