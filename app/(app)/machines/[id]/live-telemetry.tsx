"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Activity,
  Gauge,
  Wrench as WrenchIcon,
  Cpu,
  Zap,
  Flame,
  Wifi,
  WifiOff,
  AlertTriangle,
  Droplet,
  Droplets,
  Wind,
  DoorOpen,
  OctagonX,
  Snowflake,
  Lock,
  Move3d,
  RefreshCw,
  Sparkles,
  Battery,
  Sparkle,
  Thermometer,
  Maximize2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MachineStatus } from "@/lib/supabase/types";

interface Props {
  machineId: string;
  status: MachineStatus;
  toolHints?: { name: string; code: string | null; size: string | null }[];
}

type LiveState = "running" | "idle" | "alarm" | "offline";

// 15 alarm types — covers what a CNC operator typically sees on the panel.
type AlarmType =
  | "yag"
  | "hava"
  | "kapi"
  | "acil"
  | "sogutma"
  | "tabla"
  | "servo"
  | "eksen"
  | "takim"
  | "magazin"
  | "cip"
  | "hidrolik"
  | "park"
  | "lub"
  | "sicaklik";

interface AlarmDef {
  type: AlarmType;
  icon: LucideIcon;
  label: string;
  code: string;
  alertText: string; // toast message when raised
}

const ALARM_DEFS: AlarmDef[] = [
  { type: "yag",       icon: Droplet,     label: "Yağ",         code: "X1232", alertText: "MAKİNE DURDU — YAĞ SEVİYESİ DÜŞÜK" },
  { type: "hava",      icon: Wind,        label: "Hava",        code: "X0501", alertText: "MAKİNE DURDU — HAVA BASINCI DÜŞÜK" },
  { type: "kapi",      icon: DoorOpen,    label: "Kapı",        code: "M0010", alertText: "KAPI AÇIK — ÜRETİM DURDU" },
  { type: "acil",      icon: OctagonX,    label: "Acil Stop",   code: "M0001", alertText: "ACİL STOP BASILDI" },
  { type: "sogutma",   icon: Snowflake,   label: "Soğutma",     code: "X0701", alertText: "SOĞUTMA SIVISI DÜŞÜK" },
  { type: "tabla",     icon: Lock,        label: "Tabla",       code: "M0020", alertText: "TABLA SABİTLENMEDİ" },
  { type: "servo",     icon: Zap,         label: "Servo",       code: "AL400", alertText: "SERVO ALARM — EKSEN HATALI" },
  { type: "eksen",     icon: Move3d,      label: "Eksen Limit", code: "AL510", alertText: "EKSEN SOFTWARE LİMİT AŞILDI" },
  { type: "takim",     icon: WrenchIcon,  label: "Takım",       code: "X1500", alertText: "TAKIM KIRIK / TESPİT EDİLEMEDİ" },
  { type: "magazin",   icon: RefreshCw,   label: "Magazin",     code: "X1601", alertText: "TAKIM DEĞİŞTİRİCİ HATA" },
  { type: "cip",       icon: Sparkles,    label: "Çip",         code: "X0801", alertText: "ÇİP KONVEYÖRÜ TIKANDI" },
  { type: "hidrolik",  icon: Droplets,    label: "Hidrolik",    code: "X1300", alertText: "HİDROLİK BASINÇ DÜŞÜK" },
  { type: "park",      icon: Battery,     label: "Pil",         code: "AL999", alertText: "ENKODER PİLİ DÜŞÜK" },
  { type: "lub",       icon: Sparkle,     label: "Yağlama",     code: "X1240", alertText: "OTOMATİK YAĞLAMA HATALI" },
  { type: "sicaklik",  icon: Thermometer, label: "Sıcaklık",    code: "X1100", alertText: "SPİNDLE SICAKLIK YÜKSEK" },
];

const ALARM_BY_TYPE = new Map(ALARM_DEFS.map((a) => [a.type, a]));

interface ActiveAlarm {
  type: AlarmType;
  raisedAt: number;
}

interface Telemetry {
  state: LiveState;
  spindleRpm: number;
  spindleLoadPct: number;
  feedOverride: number;
  programIndex: number; // index into PROGRAM array
  activeTool: string;
  alarms: AlarmType[];
  alarmHistory: ActiveAlarm[]; // most recent first
  lastHeartbeatMs: number;
}

// Sample G-code — realistic-ish sequence that operators recognise.
const PROGRAM: string[] = [
  "%",
  "O0042 (TG-MIL-50 FINISH)",
  "(MAT: 6061-T6 ALU)",
  "(TOOL T1 D6 KARBUR FREZE)",
  "G21 G54 G90 G94 G17",
  "G91 G28 Z0",
  "G90",
  "T1 M06",
  "S14000 M03",
  "M08",
  "G00 X-5. Y0. Z25.",
  "G00 Z3.",
  "G01 Z-1.5 F600",
  "G01 X55. F1500",
  "G01 Y50.",
  "G01 X-5.",
  "G01 Y0.",
  "G00 Z3.",
  "G01 Z-3.0 F600",
  "G01 X55. F1500",
  "G01 Y50.",
  "G01 X-5.",
  "G01 Y0.",
  "G00 Z25.",
  "M09",
  "T2 M06",
  "(TOOL T2 D10 KARBUR ENDMILL)",
  "S10000 M03",
  "M08",
  "G00 X10. Y10. Z25.",
  "G00 Z2.",
  "G01 Z-2.0 F400",
  "G02 X40. Y10. I15. J0. F900",
  "G02 X10. Y10. I-15. J0.",
  "G00 Z25.",
  "G00 X25. Y25.",
  "G01 Z-4.0 F400",
  "G03 X25. Y25. I10. J0. F900",
  "G00 Z25.",
  "M09",
  "T3 M06",
  "(TOOL T3 D5 MATKAP)",
  "S5500 M03",
  "M08",
  "G81 R3. Z-12. F250",
  "X10. Y10.",
  "X40. Y10.",
  "X40. Y40.",
  "X10. Y40.",
  "G80",
  "G00 Z25.",
  "M09",
  "T4 M06",
  "(TOOL T4 M6 KILAVUZ)",
  "S400 M29",
  "M08",
  "G84 R5. Z-15. F500",
  "X10. Y10.",
  "X40. Y10.",
  "X40. Y40.",
  "X10. Y40.",
  "G80",
  "M09",
  "G91 G28 Z0",
  "G91 G28 Y0",
  "G90",
  "M30",
  "%",
];

function pickRandomTool(toolHints: Props["toolHints"]): string {
  if (!toolHints || toolHints.length === 0) return "T1 — (boş)";
  const t = toolHints[Math.floor(Math.random() * toolHints.length)];
  const num = Math.floor(Math.random() * 24) + 1;
  return `T${num} — ${t.name}${t.size ? ` (${t.size})` : ""}`;
}

function nextTelemetry(
  prev: Telemetry,
  status: MachineStatus,
  toolHints: Props["toolHints"],
): Telemetry {
  // Active alarms drive state — any alarm halts the spindle in real life.
  let alarms = [...prev.alarms];

  // Random small probability of clearing an existing alarm (operator handled it)
  alarms = alarms.filter(() => Math.random() > 0.2);

  // If machine is in 'ariza' status, keep at least one alarm raised
  if (status === "ariza" && alarms.length === 0) {
    alarms.push("servo");
  }

  // Random small chance of new alarm if running
  if (status === "aktif" && Math.random() < 0.1) {
    const def = ALARM_DEFS[Math.floor(Math.random() * ALARM_DEFS.length)];
    if (!alarms.includes(def.type)) alarms.push(def.type);
  }

  // Determine state
  const state: LiveState =
    alarms.length > 0
      ? "alarm"
      : status === "bakim" || status === "durus"
      ? "offline"
      : status === "aktif"
      ? Math.random() > 0.1
        ? "running"
        : "idle"
      : "idle";

  const targetRpm = state === "running" ? 12000 + Math.floor(Math.random() * 6000) : 0;
  const spindleRpm = Math.max(0, Math.round(prev.spindleRpm + (targetRpm - prev.spindleRpm) * 0.4));

  const spindleLoadPct =
    state === "running"
      ? Math.max(20, Math.min(95, prev.spindleLoadPct + (Math.random() * 20 - 10)))
      : Math.max(0, prev.spindleLoadPct - 15);

  const feedOverride =
    state === "running"
      ? Math.max(80, Math.min(120, prev.feedOverride + (Math.random() * 6 - 3)))
      : 100;

  // Program advances only when running
  let programIndex = prev.programIndex;
  if (state === "running") {
    programIndex = (programIndex + 1) % PROGRAM.length;
  }

  // Update history with newly raised alarms
  const newlyRaised = alarms.filter((a) => !prev.alarms.includes(a));
  const history = [
    ...newlyRaised.map((type) => ({ type, raisedAt: Date.now() })),
    ...prev.alarmHistory,
  ].slice(0, 20);

  return {
    state,
    spindleRpm,
    spindleLoadPct: Math.round(spindleLoadPct),
    feedOverride: Math.round(feedOverride),
    programIndex,
    activeTool: pickRandomTool(toolHints),
    alarms,
    alarmHistory: history,
    lastHeartbeatMs: Date.now(),
  };
}

export function LiveTelemetry({ machineId, status, toolHints }: Props) {
  const [telem, setTelem] = useState<Telemetry>(() => ({
    state: "idle",
    spindleRpm: 0,
    spindleLoadPct: 0,
    feedOverride: 100,
    programIndex: 0,
    activeTool: toolHints?.[0]?.name ? `T1 — ${toolHints[0].name}` : "T1 — (boş)",
    alarms: [],
    alarmHistory: [],
    lastHeartbeatMs: Date.now(),
  }));

  const [programOpen, setProgramOpen] = useState(false);
  const previousAlarmsRef = useRef<AlarmType[]>([]);

  // Tick every 2s — simulate live data
  useEffect(() => {
    setTelem((prev) => nextTelemetry(prev, status, toolHints));
    const id = setInterval(() => {
      setTelem((prev) => nextTelemetry(prev, status, toolHints));
    }, 2000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [machineId, status]);

  // Fire toast for newly raised alarms
  useEffect(() => {
    const prev = new Set(previousAlarmsRef.current);
    for (const a of telem.alarms) {
      if (!prev.has(a)) {
        const def = ALARM_BY_TYPE.get(a);
        if (def) {
          toast.error(def.alertText, {
            description: `${def.code} · ${def.label}`,
            duration: 5000,
          });
        }
      }
    }
    previousAlarmsRef.current = telem.alarms;
  }, [telem.alarms]);

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
      <CardContent className="p-5 space-y-5">
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

        {/* Top metric tiles */}
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
              telem.spindleLoadPct > 85 ? "warn" : telem.spindleLoadPct > 0 ? "default" : "muted"
            }
          />
          <Metric icon={WrenchIcon} label="Aktif Takım" value={telem.activeTool} unit="" small />
          <Metric icon={Zap} label="Feed Override" value={`%${telem.feedOverride}`} unit="" />
        </div>

        {/* Program window */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
              <Cpu className="size-3" /> Program · Satır{" "}
              <span className="font-mono normal-case tracking-normal text-foreground">
                {telem.programIndex + 1}
              </span>{" "}
              / {PROGRAM.length}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs gap-1"
              onClick={() => setProgramOpen(true)}
            >
              <Maximize2 className="size-3" /> Tüm Programı Gör
            </Button>
          </div>
          <ProgramWindow lines={PROGRAM} currentIndex={telem.programIndex} />
        </div>

        {/* 15 status indicator cards */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Durum Göstergeleri
          </div>
          <div className="grid grid-cols-5 gap-2">
            {ALARM_DEFS.map((def) => {
              const active = telem.alarms.includes(def.type);
              return <StatusCard key={def.type} def={def} active={active} />;
            })}
          </div>
        </div>

        {/* Alarm log */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center justify-between">
            <span>Hata Logları</span>
            <span className="font-mono normal-case tracking-normal text-foreground">
              {telem.alarmHistory.length}
            </span>
          </div>
          {telem.alarmHistory.length === 0 ? (
            <div className="rounded-lg border bg-muted/20 p-3 text-center text-xs text-muted-foreground">
              Henüz hata yok.
            </div>
          ) : (
            <div className="rounded-lg border bg-muted/10 max-h-48 overflow-y-auto divide-y">
              {telem.alarmHistory.map((entry, i) => {
                const def = ALARM_BY_TYPE.get(entry.type);
                if (!def) return null;
                const Icon = def.icon;
                const stillActive = telem.alarms.includes(entry.type);
                return (
                  <div
                    key={`${entry.type}-${entry.raisedAt}-${i}`}
                    className="flex items-center gap-2 px-3 py-2 text-xs"
                  >
                    <Icon
                      className={cn(
                        "size-3.5 shrink-0",
                        stillActive ? "text-red-600" : "text-muted-foreground",
                      )}
                    />
                    <span className="font-mono text-[11px] tabular-nums text-muted-foreground w-20 shrink-0">
                      {def.code}
                    </span>
                    <span className="font-medium flex-1 truncate">{def.alertText}</span>
                    {stillActive && (
                      <Badge
                        variant="outline"
                        className="h-5 text-[10px] bg-red-500/10 text-red-600 border-red-500/40"
                      >
                        AKTİF
                      </Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                      {Math.max(0, Math.round((Date.now() - entry.raisedAt) / 1000))} sn önce
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="text-[10px] text-muted-foreground italic">
          ⓘ Bu kart şu an mock veri gösteriyor — gerçek MTConnect / FOCAS adaptörü
          bağlandığında otomatik canlı veriye geçecek.
        </div>
      </CardContent>

      {/* Full program popup */}
      <ProgramPopup
        open={programOpen}
        onOpenChange={setProgramOpen}
        lines={PROGRAM}
        currentIndex={telem.programIndex}
        activeAlarms={telem.alarms}
      />
    </Card>
  );
}

/* ────────────────────────────────────────────────────────── */

function StatusCard({ def, active }: { def: AlarmDef; active: boolean }) {
  const Icon = def.icon;
  return (
    <div
      className={cn(
        "aspect-square rounded-lg border flex flex-col items-center justify-center gap-1 p-2 transition relative",
        active
          ? "bg-red-500/15 border-red-500/60 shadow-[inset_0_0_0_1px_rgba(220,38,38,0.4)]"
          : "bg-muted/30 border-border",
      )}
    >
      {active && (
        <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-red-500 animate-pulse" />
      )}
      <Icon
        className={cn(
          "size-5",
          active ? "text-red-600" : "text-muted-foreground/60",
        )}
      />
      <div
        className={cn(
          "text-[10px] font-semibold leading-tight text-center",
          active ? "text-red-700 dark:text-red-400" : "text-muted-foreground",
        )}
      >
        {def.label}
      </div>
    </div>
  );
}

function ProgramWindow({
  lines,
  currentIndex,
}: {
  lines: string[];
  currentIndex: number;
}) {
  // 10-line window centred on current
  const window = 10;
  const half = Math.floor(window / 2);
  let start = Math.max(0, currentIndex - half);
  if (start + window > lines.length) start = Math.max(0, lines.length - window);
  const visible = lines.slice(start, start + window);

  return (
    <div className="rounded-lg border bg-zinc-950 text-zinc-100 font-mono text-xs overflow-hidden">
      {visible.map((line, i) => {
        const idx = start + i;
        const isCurrent = idx === currentIndex;
        return (
          <div
            key={idx}
            className={cn(
              "flex items-center gap-3 px-3 py-1.5 leading-tight",
              isCurrent
                ? "bg-emerald-500/30 text-emerald-100 border-l-2 border-emerald-400"
                : "border-l-2 border-transparent hover:bg-zinc-900/60",
            )}
          >
            <span
              className={cn(
                "tabular-nums w-10 text-right shrink-0",
                isCurrent ? "text-emerald-300 font-bold" : "text-zinc-500",
              )}
            >
              {idx + 1}
            </span>
            <span className="truncate">
              {isCurrent && <span className="mr-1">▶</span>}
              {line || " "}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ProgramPopup({
  open,
  onOpenChange,
  lines,
  currentIndex,
  activeAlarms,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lines: string[];
  currentIndex: number;
  activeAlarms: AlarmType[];
}) {
  const currentLineRef = useRef<HTMLDivElement>(null);

  // Scroll current line into view when opening
  useEffect(() => {
    if (open) {
      // small delay so dialog is mounted
      const t = setTimeout(() => {
        currentLineRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 50);
      return () => clearTimeout(t);
    }
  }, [open, currentIndex]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle>Program Görüntüleyici</DialogTitle>
          <DialogDescription>
            Aktif satır:{" "}
            <span className="font-mono font-bold text-foreground">
              {currentIndex + 1}
            </span>{" "}
            / {lines.length}
          </DialogDescription>
        </DialogHeader>

        {/* Active alarm strip — visible at top so operator sees why machine stopped */}
        {activeAlarms.length > 0 && (
          <div className="px-4 py-2 border-b bg-red-500/10">
            <div className="text-[10px] font-bold uppercase tracking-wider text-red-700 mb-1.5">
              Aktif Alarmlar ({activeAlarms.length})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {activeAlarms.map((a) => {
                const def = ALARM_BY_TYPE.get(a);
                if (!def) return null;
                const Icon = def.icon;
                return (
                  <Badge
                    key={a}
                    variant="outline"
                    className="bg-red-500/15 text-red-700 border-red-500/40 gap-1 font-mono"
                  >
                    <Icon className="size-3" />
                    {def.code} · {def.label}
                  </Badge>
                );
              })}
            </div>
          </div>
        )}

        {/* Full program with current highlighted */}
        <div className="overflow-y-auto bg-zinc-950 text-zinc-100 font-mono text-xs flex-1">
          {lines.map((line, idx) => {
            const isCurrent = idx === currentIndex;
            return (
              <div
                key={idx}
                ref={isCurrent ? currentLineRef : undefined}
                className={cn(
                  "flex items-center gap-3 px-4 py-1.5 leading-tight",
                  isCurrent
                    ? "bg-emerald-500/30 text-emerald-100 border-l-4 border-emerald-400"
                    : "border-l-4 border-transparent hover:bg-zinc-900/60",
                )}
              >
                <span
                  className={cn(
                    "tabular-nums w-12 text-right shrink-0",
                    isCurrent ? "text-emerald-300 font-bold" : "text-zinc-500",
                  )}
                >
                  {idx + 1}
                </span>
                <span className="truncate">
                  {isCurrent && <span className="mr-1">▶</span>}
                  {line || " "}
                </span>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
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
  icon: LucideIcon;
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
        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      </div>
    </div>
  );
}
