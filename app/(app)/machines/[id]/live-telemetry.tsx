"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  Gauge,
  Wrench,
  Cpu,
  Zap,
  Flame,
  Wifi,
  WifiOff,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MachineStatus } from "@/lib/supabase/types";

interface Props {
  machineId: string;
  status: MachineStatus;
  // Optional: pass current job's tool list so the "active tool" line is realistic.
  toolHints?: { name: string; code: string | null; size: string | null }[];
}

type LiveState = "running" | "idle" | "alarm" | "offline";

interface Telemetry {
  state: LiveState;
  spindleRpm: number;
  spindleLoadPct: number;
  feedOverride: number;
  programLine: number;
  activeTool: string;
  alarmCode: string | null;
  lastHeartbeatMs: number;
}

// Pure-frontend mock generator — produces values that LOOK alive but are not
// real. When a real LAN/MTConnect adapter lands, swap this with a fetch loop.
function mockTelemetry(
  base: Telemetry,
  status: MachineStatus,
  toolHints: Props["toolHints"],
): Telemetry {
  // Map machine status from DB to live state
  const state: LiveState =
    status === "ariza"
      ? "alarm"
      : status === "bakim" || status === "durus"
      ? "offline"
      : Math.random() > 0.15
      ? "running"
      : "idle";

  // Base RPM band varies a touch each tick
  const targetRpm =
    state === "running" ? 12000 + Math.floor(Math.random() * 6000) : 0;
  const spindleRpm = Math.round(
    base.spindleRpm + (targetRpm - base.spindleRpm) * 0.3,
  );

  const spindleLoadPct =
    state === "running"
      ? Math.max(20, Math.min(95, base.spindleLoadPct + (Math.random() * 20 - 10)))
      : 0;

  const feedOverride =
    state === "running"
      ? Math.max(80, Math.min(120, base.feedOverride + (Math.random() * 6 - 3)))
      : 100;

  const programLine =
    state === "running" ? base.programLine + 1 + Math.floor(Math.random() * 3) : base.programLine;

  // Pick an "active tool" from the job's tool list if any, otherwise a fake one.
  let activeTool = base.activeTool;
  if (toolHints && toolHints.length > 0) {
    const t = toolHints[Math.floor(Math.random() * toolHints.length)];
    const num = Math.floor(Math.random() * 24) + 1;
    activeTool = `T${num} — ${t.name}${t.size ? ` (${t.size})` : ""}`;
  }

  const alarmCode = state === "alarm" ? base.alarmCode || "OT0001" : null;

  return {
    state,
    spindleRpm,
    spindleLoadPct: Math.round(spindleLoadPct),
    feedOverride: Math.round(feedOverride),
    programLine,
    activeTool,
    alarmCode,
    lastHeartbeatMs: Date.now(),
  };
}

export function LiveTelemetry({ machineId, status, toolHints }: Props) {
  const [telem, setTelem] = useState<Telemetry>(() => ({
    state: "idle",
    spindleRpm: 0,
    spindleLoadPct: 0,
    feedOverride: 100,
    programLine: 0,
    activeTool: toolHints?.[0]?.name
      ? `T1 — ${toolHints[0].name}`
      : "T1 — (boş)",
    alarmCode: null,
    lastHeartbeatMs: Date.now(),
  }));

  // Drive the mock — every 2s tick varies values a bit so the card feels alive.
  useEffect(() => {
    // Initial seed once after mount so server/client text isn't different.
    setTelem((prev) => mockTelemetry(prev, status, toolHints));
    const id = setInterval(() => {
      setTelem((prev) => mockTelemetry(prev, status, toolHints));
    }, 2000);
    return () => clearInterval(id);
    // machineId in deps so swapping machines resets the state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [machineId, status]);

  const stateMeta = {
    running: {
      label: "ÇALIŞIYOR",
      tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40",
      pulse: "bg-emerald-500",
      icon: Activity,
    },
    idle: {
      label: "BOŞTA",
      tone: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/40",
      pulse: "bg-zinc-400",
      icon: Activity,
    },
    alarm: {
      label: "ALARM",
      tone: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40",
      pulse: "bg-red-500",
      icon: AlertTriangle,
    },
    offline: {
      label: "ÇEVRİMDIŞI",
      tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40",
      pulse: "bg-amber-500",
      icon: WifiOff,
    },
  } as const;

  const m = stateMeta[telem.state];
  const StateIcon = m.icon;

  return (
    <Card className="mb-6 overflow-hidden gap-0 py-0">
      <div className={cn("h-1 w-full", m.pulse)} />
      <CardContent className="p-5 space-y-4">
        {/* Header strip */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "size-10 rounded-xl flex items-center justify-center border-2",
                m.tone,
              )}
            >
              <StateIcon className="size-5" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Canlı Durum
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold">{m.label}</span>
                <span
                  className={cn(
                    "size-2 rounded-full",
                    m.pulse,
                    telem.state === "running" && "animate-pulse",
                  )}
                />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="font-normal gap-1 bg-amber-500/10 text-amber-700 border-amber-500/40"
            >
              DEMO VERİ
            </Badge>
            <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
              <Wifi className="size-3" />
              {Math.max(0, Math.round((Date.now() - telem.lastHeartbeatMs) / 1000))}{" "}
              sn önce
            </span>
          </div>
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Metric
            icon={Gauge}
            label="Spindle"
            value={telem.spindleRpm.toLocaleString("tr-TR")}
            unit="dev/dk"
            primary={telem.state === "running"}
          />
          <Metric
            icon={Flame}
            label="Spindle Yükü"
            value={`%${telem.spindleLoadPct}`}
            unit=""
            tone={
              telem.spindleLoadPct > 85
                ? "warn"
                : telem.spindleLoadPct > 0
                ? "default"
                : "muted"
            }
          />
          <Metric
            icon={Wrench}
            label="Aktif Takım"
            value={telem.activeTool}
            unit=""
            small
          />
          <Metric
            icon={Zap}
            label="Feed Override"
            value={`%${telem.feedOverride}`}
            unit=""
          />
        </div>

        <div className="grid grid-cols-2 gap-3 pt-3 border-t">
          <div className="flex items-center gap-2">
            <Cpu className="size-3.5 text-muted-foreground" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Program Satırı:
            </span>
            <span className="text-sm font-mono tabular-nums">
              {telem.programLine || "—"}
            </span>
          </div>
          <div className="flex items-center gap-2 justify-end">
            {telem.alarmCode ? (
              <>
                <AlertTriangle className="size-3.5 text-red-600" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Alarm:
                </span>
                <span className="text-sm font-mono text-red-600 font-semibold">
                  {telem.alarmCode}
                </span>
              </>
            ) : (
              <span className="text-[11px] text-muted-foreground">Alarm yok</span>
            )}
          </div>
        </div>

        <div className="text-[10px] text-muted-foreground italic">
          ⓘ Bu kart şu an mock veri gösteriyor — gerçek MTConnect / FOCAS
          adaptörü bağlandığında otomatik canlı veriye geçecek.
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  unit,
  tone = "default",
  primary = false,
  small = false,
}: {
  icon: typeof Gauge;
  label: string;
  value: string;
  unit: string;
  tone?: "default" | "warn" | "muted";
  primary?: boolean;
  small?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        <Icon className="size-3" />
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span
          className={cn(
            "font-bold tabular-nums leading-tight",
            small ? "text-sm" : "text-2xl",
            primary && "text-primary",
            tone === "warn" && "text-amber-600",
            tone === "muted" && "text-muted-foreground",
          )}
        >
          {value}
        </span>
        {unit && (
          <span className="text-xs text-muted-foreground">{unit}</span>
        )}
      </div>
    </div>
  );
}
