"use client";

import { useMemo, useState, useTransition } from "react";
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
import { Loader2, Search, Check } from "lucide-react";
import {
  CONVERSATION_COLOR_PRESETS,
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

export function NewConversationDialog({
  trigger,
  currentUserId,
  people,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"direct" | "group">("direct");
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");

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

  function reset() {
    setTab("direct");
    setSearch("");
    setTitle("");
    setColor(CONVERSATION_COLOR_PRESETS[0].hex);
    setMemberIds(new Set());
  }

  function toggleMember(id: string) {
    setMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function startDirect(otherId: string) {
    startTransition(async () => {
      const r = await getOrCreateDirectConversation(otherId);
      if ("error" in r && r.error) {
        toast.error(r.error);
        return;
      }
      const id = "id" in r ? r.id : null;
      if (id) {
        setOpen(false);
        reset();
        router.push(`/messages?c=${id}`);
      }
    });
  }

  function startGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Grup adı gerekli");
      return;
    }
    if (memberIds.size === 0) {
      toast.error("En az bir üye seç");
      return;
    }
    startTransition(async () => {
      const r = await createGroupConversation({
        title,
        color,
        memberIds: Array.from(memberIds),
      });
      if ("error" in r && r.error) {
        toast.error(r.error);
        return;
      }
      const id = "id" in r ? r.id : null;
      if (id) {
        setOpen(false);
        reset();
        toast.success("Grup oluşturuldu");
        router.push(`/messages?c=${id}`);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Yeni Mesajlaşma</DialogTitle>
          <DialogDescription>
            Birebir konuşma başlat ya da grup oluştur.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "direct" | "group")}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="direct">Birebir</TabsTrigger>
            <TabsTrigger value="group">Grup</TabsTrigger>
          </TabsList>

          {/* Direct */}
          <TabsContent value="direct" className="space-y-3 mt-3">
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
            <div className="rounded-md border max-h-72 overflow-y-auto divide-y">
              {filteredCandidates.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Eşleşen kişi yok.
                </div>
              ) : (
                filteredCandidates.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => startDirect(p.id)}
                    disabled={pending}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/60 transition text-left disabled:opacity-50"
                  >
                    <Avatar className="size-9">
                      <AvatarFallback className="text-xs font-semibold bg-primary/15 text-primary">
                        {initials(p.full_name || p.phone)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold truncate">
                        {p.full_name || formatPhoneForDisplay(p.phone) || "—"}
                      </div>
                      <div className="text-[11px] text-muted-foreground font-mono truncate">
                        {formatPhoneForDisplay(p.phone)}
                      </div>
                    </div>
                    {pending && (
                      <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    )}
                  </button>
                ))
              )}
            </div>
          </TabsContent>

          {/* Group */}
          <TabsContent value="group" className="mt-3">
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
                <div className="rounded-md border max-h-56 overflow-y-auto divide-y">
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

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  İptal
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending && <Loader2 className="size-4 animate-spin" />}
                  Grubu Oluştur
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
