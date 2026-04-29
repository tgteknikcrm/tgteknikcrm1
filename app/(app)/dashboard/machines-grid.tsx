"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Factory,
  Wrench,
  Clock,
  AlertTriangle,
  PauseCircle,
  Coffee,
  Eye,
  EyeOff,
  Check,
  GripVertical,
} from "lucide-react";
import {
  MACHINE_STATUS_LABEL,
  MACHINE_STATUS_TONE,
} from "@/lib/supabase/types";
import type { Machine } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "tg.dashboard.hiddenMachines";
const ORDER_KEY = "tg.dashboard.machineOrder";

export type MachineCardData = {
  machine: Machine;
  job: {
    id: string;
    job_no: string | null;
    part_name: string;
    quantity: number;
    customer: string;
  } | null;
  totalProduced: number;
  operatorName: string | null;
  startTime: string | null;
  endTime: string | null;
};

export function MachinesGrid({ cards }: { cards: MachineCardData[] }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [order, setOrder] = useState<string[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setHidden(new Set(JSON.parse(raw) as string[]));
      const orderRaw = localStorage.getItem(ORDER_KEY);
      if (orderRaw) {
        const arr = JSON.parse(orderRaw);
        if (Array.isArray(arr)) setOrder(arr.filter((v) => typeof v === "string"));
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(hidden)));
    } catch {
      /* ignore */
    }
  }, [hidden, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(ORDER_KEY, JSON.stringify(order));
    } catch {
      /* ignore */
    }
  }, [order, hydrated]);

  function toggle(id: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Apply persisted order on top of the server-provided cards. Unknown
  // (newly added) machines fall to the end so the user never loses sight
  // of them; missing ids are silently dropped.
  const orderedCards = useMemo(() => {
    if (order.length === 0) return cards;
    const cardMap = new Map(cards.map((c) => [c.machine.id, c]));
    const seen = new Set<string>();
    const result: MachineCardData[] = [];
    for (const id of order) {
      const c = cardMap.get(id);
      if (c) {
        result.push(c);
        seen.add(id);
      }
    }
    for (const c of cards) if (!seen.has(c.machine.id)) result.push(c);
    return result;
  }, [cards, order]);

  const list = editMode
    ? orderedCards
    : orderedCards.filter((c) => !hidden.has(c.machine.id));
  const hiddenCount = hidden.size;

  // ── Drag-drop reorder (Pointer Events; works with mouse + touch + pen) ──
  function onCardPointerDown(id: string, e: React.PointerEvent<HTMLDivElement>) {
    if (!editMode) return;
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* some browsers throw on capture for synthetic touches */
    }
    setDraggingId(id);
    // Seed the order array on first drag so subsequent splices work.
    setOrder((prev) =>
      prev.length === 0 ? cards.map((c) => c.machine.id) : prev,
    );
  }

  function onCardPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingId) return;
    const els = document.elementsFromPoint(e.clientX, e.clientY);
    const target = els.find(
      (el) =>
        el instanceof HTMLElement &&
        el.dataset.machineCard === "1" &&
        el.dataset.machineId &&
        el.dataset.machineId !== draggingId,
    ) as HTMLElement | undefined;
    if (!target) return;
    const overId = target.dataset.machineId!;
    setOrder((prev) => {
      const ids = prev.length === 0 ? cards.map((c) => c.machine.id) : prev;
      const fromIdx = ids.indexOf(draggingId);
      const toIdx = ids.indexOf(overId);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return ids;
      const next = [...ids];
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, draggingId);
      return next;
    });
  }

  function onCardPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingId) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    setDraggingId(null);
  }

  function resetOrder() {
    setOrder([]);
  }

  return (
    <>
      <div className="flex items-center justify-between mt-8 mb-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <Factory className="size-4" /> Makineler
          {hydrated && hiddenCount > 0 && !editMode && (
            <span className="ml-1.5 text-[10px] font-medium normal-case opacity-70 tracking-normal">
              ({hiddenCount} gizli)
            </span>
          )}
        </h2>
        <Button
          type="button"
          variant={editMode ? "default" : "outline"}
          size="sm"
          onClick={() => setEditMode((v) => !v)}
          className="h-8 gap-1.5"
        >
          {editMode ? (
            <>
              <Check className="size-4" /> Tamam
            </>
          ) : (
            <>
              <Eye className="size-4" /> Göster / Gizle
            </>
          )}
        </Button>
      </div>

      {editMode && (
        <div className="mb-3 flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs text-muted-foreground">
            Düzenleme modundasın. Kartı{" "}
            <span className="font-medium text-foreground">basılı tutup</span>{" "}
            sürükleyerek yer değiştirebilir, sağ üstteki göz ikonuyla
            gizle/göster yapabilirsin. Bittiğinde
            <span className="mx-1 font-medium text-foreground">Tamam</span>
            tuşuna bas.
          </p>
          {order.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetOrder}
              className="h-7 text-[11px] text-muted-foreground"
            >
              Sıralamayı sıfırla
            </Button>
          )}
        </div>
      )}

      <div className="grid auto-rows-fr grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {list.map((c) => {
          const isHidden = hidden.has(c.machine.id);
          const isDragging = draggingId === c.machine.id;
          return (
            <div
              key={c.machine.id}
              data-machine-card="1"
              data-machine-id={c.machine.id}
              onPointerDown={(e) => onCardPointerDown(c.machine.id, e)}
              onPointerMove={onCardPointerMove}
              onPointerUp={onCardPointerUp}
              onPointerCancel={onCardPointerUp}
              className={cn(
                "relative h-full transition-transform",
                editMode && "cursor-grab",
                isDragging &&
                  "cursor-grabbing opacity-70 scale-[0.97] z-30 ring-2 ring-primary rounded-xl shadow-2xl",
              )}
              style={
                editMode
                  ? { touchAction: "none", userSelect: "none" }
                  : undefined
              }
            >
              {editMode && (
                <>
                  <div
                    className="absolute top-3 left-3 z-20 size-8 rounded-full bg-background/95 backdrop-blur-md border shadow-sm flex items-center justify-center text-muted-foreground pointer-events-none"
                    title="Sürükle"
                    aria-hidden
                  >
                    <GripVertical className="size-4" />
                  </div>
                  <button
                    type="button"
                    onClick={() => toggle(c.machine.id)}
                    onPointerDown={(e) => e.stopPropagation()}
                    className={cn(
                      "absolute top-3 right-3 z-20 size-8 rounded-full",
                      "bg-background/95 backdrop-blur-md border shadow-sm",
                      "flex items-center justify-center transition",
                      isHidden
                        ? "text-amber-600 border-amber-300 dark:border-amber-700"
                        : "hover:bg-accent",
                    )}
                    title={isHidden ? "Göster" : "Gizle"}
                  >
                    {isHidden ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </>
              )}
              <div
                className={cn(
                  "h-full transition-opacity",
                  editMode && isHidden && "opacity-40",
                  // While drag is active, suppress hover/translate effects on
                  // the inner card to keep the visual stable.
                  isDragging && "pointer-events-none",
                )}
              >
                <MachineStatusCard card={c} disableLink={editMode} />
              </div>
            </div>
          );
        })}
        {hydrated && list.length === 0 && !editMode && (
          <div className="col-span-full text-center py-12 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
            Tüm makineler gizli.{" "}
            <button
              onClick={() => setEditMode(true)}
              className="underline font-medium text-foreground"
            >
              Göster / Gizle
            </button>{" "}
            tuşuyla geri aç.
          </div>
        )}
      </div>
    </>
  );
}

function MachineStatusCard({
  card,
  disableLink,
}: {
  card: MachineCardData;
  disableLink?: boolean;
}) {
  const { machine: m, job, totalProduced, operatorName, startTime, endTime } = card;
  const tone = MACHINE_STATUS_TONE[m.status];
  const pct =
    job && job.quantity > 0
      ? Math.min(100, Math.round((totalProduced / job.quantity) * 100))
      : 0;
  const initials = operatorName
    ? operatorName
        .split(" ")
        .map((s) => s[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?";

  const inner = (
    <Card
      className={cn(
        "relative h-full flex flex-col overflow-hidden gap-0 py-0",
        "transition-all duration-200 ease-out",
        !disableLink && "hover:shadow-lg hover:-translate-y-0.5",
        "bg-gradient-to-b from-card to-muted/20",
      )}
    >
      <div className={cn("h-1 w-full", tone.dot)} />

      <CardHeader className="pt-5 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base font-bold tracking-tight truncate">
              {m.name}
            </CardTitle>
            <p className="text-[11px] text-muted-foreground truncate font-mono mt-0.5">
              {m.model || "—"}
            </p>
          </div>
          <Badge
            variant="outline"
            className={cn("border gap-1.5 font-medium", tone.badge)}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                tone.dot,
                m.status === "aktif" && "animate-pulse",
              )}
            />
            {MACHINE_STATUS_LABEL[m.status]}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col pt-0 pb-5">
        {job ? (
          <div className="flex-1 flex flex-col justify-between gap-4">
            <div>
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Üretim
                </span>
                <span className="text-xs font-bold tabular-nums text-foreground">
                  %{pct}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold font-mono tabular-nums leading-none">
                  {totalProduced}
                </span>
                <span className="text-sm text-muted-foreground tabular-nums">
                  / {job.quantity}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                <span className="truncate">{job.part_name}</span>
                {job.job_no && (
                  <span className="opacity-60 font-mono shrink-0">
                    #{job.job_no}
                  </span>
                )}
              </div>
              <div className="mt-3 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500 ease-out",
                    tone.dot,
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            <div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <TimeBlock label="Başlama" time={startTime} />
                <TimeBlock label="Bitiş" time={endTime} />
              </div>

              <div className="mt-4 pt-4 border-t border-border/60 flex items-center gap-2.5">
                <div
                  className={cn(
                    "size-8 rounded-full flex items-center justify-center text-[11px] font-bold border shrink-0",
                    tone.badge,
                  )}
                >
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Operatör
                  </div>
                  <div className="text-sm font-semibold truncate leading-tight">
                    {operatorName || "—"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <EmptyMachineState status={m.status} />
        )}
      </CardContent>
    </Card>
  );

  if (disableLink) return <div className="block h-full">{inner}</div>;
  return (
    <Link href={`/machines/${m.id}`} className="block h-full group">
      {inner}
    </Link>
  );
}

function TimeBlock({ label, time }: { label: string; time: string | null }) {
  return (
    <div className="flex items-center gap-2">
      <div className="size-7 rounded-md bg-muted/60 flex items-center justify-center shrink-0">
        <Clock className="size-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
          {label}
        </div>
        <div className="font-mono font-semibold tabular-nums text-sm leading-tight">
          {time ? time.slice(0, 5) : "—"}
        </div>
      </div>
    </div>
  );
}

function EmptyMachineState({ status }: { status: Machine["status"] }) {
  const tone = MACHINE_STATUS_TONE[status];
  const cfg =
    status === "ariza"
      ? { icon: AlertTriangle, title: "Arızalı", note: "Tezgah devre dışı" }
      : status === "bakim"
      ? { icon: Wrench, title: "Bakımda", note: "Planlı bakım" }
      : status === "durus"
      ? { icon: PauseCircle, title: "Duruşta", note: "Üretim durdu" }
      : { icon: Coffee, title: "Boşta", note: "İş atanmamış" };
  const Icon = cfg.icon;

  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-4">
      <div
        className={cn(
          "size-14 rounded-2xl flex items-center justify-center border",
          tone.badge,
        )}
      >
        <Icon className="size-6" />
      </div>
      <div>
        <p className="text-sm font-semibold">{cfg.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{cfg.note}</p>
      </div>
    </div>
  );
}
