"use client";

import { useEffect, useRef, useState } from "react";
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
  Zap,
  Flame,
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
  Cpu,
  Bell,
  BellOff,
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
  alertText: string;
}

const ALARM_DEFS: AlarmDef[] = [
  { type: "yag",       icon: Droplet,     label: "Yağ",       code: "X1232", alertText: "MAKİNE DURDU — YAĞ SEVİYESİ DÜŞÜK" },
  { type: "hava",      icon: Wind,        label: "Hava",      code: "X0501", alertText: "MAKİNE DURDU — HAVA BASINCI DÜŞÜK" },
  { type: "kapi",      icon: DoorOpen,    label: "Kapı",      code: "M0010", alertText: "KAPI AÇIK — ÜRETİM DURDU" },
  { type: "acil",      icon: OctagonX,    label: "Acil",      code: "M0001", alertText: "ACİL STOP BASILDI" },
  { type: "sogutma",   icon: Snowflake,   label: "Soğutma",   code: "X0701", alertText: "SOĞUTMA SIVISI DÜŞÜK" },
  { type: "tabla",     icon: Lock,        label: "Tabla",     code: "M0020", alertText: "TABLA SABİTLENMEDİ" },
  { type: "servo",     icon: Zap,         label: "Servo",     code: "AL400", alertText: "SERVO ALARM — EKSEN HATALI" },
  { type: "eksen",     icon: Move3d,      label: "Eksen",     code: "AL510", alertText: "EKSEN SOFTWARE LİMİT AŞILDI" },
  { type: "takim",     icon: WrenchIcon,  label: "Takım",     code: "X1500", alertText: "TAKIM KIRIK / TESPİT EDİLEMEDİ" },
  { type: "magazin",   icon: RefreshCw,   label: "Magazin",   code: "X1601", alertText: "TAKIM DEĞİŞTİRİCİ HATA" },
  { type: "cip",       icon: Sparkles,    label: "Çip",       code: "X0801", alertText: "ÇİP KONVEYÖRÜ TIKANDI" },
  { type: "hidrolik",  icon: Droplets,    label: "Hidrolik",  code: "X1300", alertText: "HİDROLİK BASINÇ DÜŞÜK" },
  { type: "park",      icon: Battery,     label: "Pil",       code: "AL999", alertText: "ENKODER PİLİ DÜŞÜK" },
  { type: "lub",       icon: Sparkle,     label: "Yağlama",   code: "X1240", alertText: "OTOMATİK YAĞLAMA HATALI" },
  { type: "sicaklik",  icon: Thermometer, label: "Sıcaklık",  code: "X1100", alertText: "SPİNDLE SICAKLIK YÜKSEK" },
];

const ALARM_BY_TYPE = new Map(ALARM_DEFS.map((a) => [a.type, a]));

interface AlarmEvent {
  type: AlarmType;
  raisedAt: number;
}

interface Telemetry {
  state: LiveState;
  spindleRpm: number;
  spindleLoadPct: number;
  feedOverride: number;
  programIndex: number;
  activeTool: string;
  alarms: AlarmType[];
  alarmHistory: AlarmEvent[];
  lastHeartbeatMs: number;
}

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
  if (!toolHints || toolHints.length === 0) return "T1";
  const t = toolHints[Math.floor(Math.random() * toolHints.length)];
  const num = Math.floor(Math.random() * 24) + 1;
  return `T${num} · ${t.name}${t.size ? ` ${t.size}` : ""}`;
}

function nextTelemetry(
  prev: Telemetry,
  status: MachineStatus,
  toolHints: Props["toolHints"],
  alarmModeOn: boolean,
): Telemetry {
  let alarms = [...prev.alarms];

  // Random clear (operator handled it)
  alarms = alarms.filter(() => Math.random() > 0.2);

  if (status === "ariza" && alarms.length === 0) alarms.push("servo");

  // Random new alarm only when alarm-mode toggle is ON.
  // 35% per 2s tick = roughly one new alarm every 5-6 seconds when ON.
  if (alarmModeOn && status === "aktif" && Math.random() < 0.35) {
    const def = ALARM_DEFS[Math.floor(Math.random() * ALARM_DEFS.length)];
    if (!alarms.includes(def.type)) alarms.push(def.type);
  }

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
  const spindleRpm = Math.max(
    0,
    Math.round(prev.spindleRpm + (targetRpm - prev.spindleRpm) * 0.4),
  );

  const spindleLoadPct =
    state === "running"
      ? Math.max(20, Math.min(95, prev.spindleLoadPct + (Math.random() * 20 - 10)))
      : Math.max(0, prev.spindleLoadPct - 15);

  const feedOverride =
    state === "running"
      ? Math.max(80, Math.min(120, prev.feedOverride + (Math.random() * 6 - 3)))
      : 100;

  let programIndex = prev.programIndex;
  if (state === "running") programIndex = (programIndex + 1) % PROGRAM.length;

  // Tool only changes on M06 lines or rare random — feel realistic
  const onToolChangeLine = state === "running" && PROGRAM[programIndex]?.includes("M06");
  const activeTool = onToolChangeLine ? pickRandomTool(toolHints) : prev.activeTool;

  const newlyRaised = alarms.filter((a) => !prev.alarms.includes(a));
  const history = [
    ...newlyRaised.map((type) => ({ type, raisedAt: Date.now() })),
    ...prev.alarmHistory,
  ].slice(0, 30);

  return {
    state,
    spindleRpm,
    spindleLoadPct: Math.round(spindleLoadPct),
    feedOverride: Math.round(feedOverride),
    programIndex,
    activeTool,
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
    activeTool: toolHints?.[0]?.name ? `T1 · ${toolHints[0].name}` : "T1",
    alarms: [],
    alarmHistory: [],
    lastHeartbeatMs: Date.now(),
  }));

  const [programOpen, setProgramOpen] = useState(false);
  const [alarmMode, setAlarmMode] = useState(false);
  const alarmModeRef = useRef(alarmMode);
  alarmModeRef.current = alarmMode;
  const previousAlarmsRef = useRef<AlarmType[]>([]);

  useEffect(() => {
    setTelem((prev) => nextTelemetry(prev, status, toolHints, alarmModeRef.current));
    const id = setInterval(() => {
      setTelem((prev) =>
        nextTelemetry(prev, status, toolHints, alarmModeRef.current),
      );
    }, 2000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [machineId, status]);

  // Toast when new alarm raised
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
    <Card className="mb-6 overflow-hidden gap-0 py-0 border-2">
      <div className={cn("h-1 w-full", m.pulse)} />
      <CardContent className="p-0">
        {/* HEADER STRIP */}
        <div className="flex items-center justify-between gap-3 flex-wrap p-4 border-b">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "size-11 rounded-xl flex items-center justify-center border-2 shrink-0",
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
                <span className="text-xl font-bold tracking-tight">{m.label}</span>
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
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAlarmMode((v) => !v)}
              className={cn(
                "h-7 gap-1.5 text-[11px] font-semibold border-2",
                alarmMode
                  ? "bg-red-500/10 text-red-700 border-red-500/40 hover:bg-red-500/20"
                  : "bg-muted/40 text-muted-foreground border-border",
              )}
              title="Mock alarm üretimini aç/kapat"
            >
              {alarmMode ? <Bell className="size-3.5" /> : <BellOff className="size-3.5" />}
              Mock Alarm: {alarmMode ? "AÇIK" : "KAPALI"}
            </Button>
          </div>
        </div>

        {/* TWO-COLUMN: METRICS (left) + PROGRAM (right) */}
        <div className="grid grid-cols-1 lg:grid-cols-5 divide-y lg:divide-y-0 lg:divide-x">
          {/* METRICS 2x2 */}
          <div className="lg:col-span-3 p-4">
            <div className="grid grid-cols-2 gap-3">
              <Metric
                icon={Gauge}
                label="Spindle"
                value={telem.spindleRpm.toLocaleString("tr-TR")}
                unit="dev/dk"
                accent="emerald"
                primary={telem.state === "running"}
              />
              <Metric
                icon={Flame}
                label="Spindle Yükü"
                value={`%${telem.spindleLoadPct}`}
                unit=""
                accent={
                  telem.spindleLoadPct > 85
                    ? "red"
                    : telem.spindleLoadPct > 0
                    ? "amber"
                    : "zinc"
                }
              />
              <Metric
                icon={WrenchIcon}
                label="Aktif Takım"
                value={telem.activeTool}
                unit=""
                accent="blue"
                small
              />
              <Metric
                icon={Zap}
                label="Feed Override"
                value={`%${telem.feedOverride}`}
                unit=""
                accent="violet"
              />
            </div>
          </div>

          {/* PROGRAM (right) — white background */}
          <div className="lg:col-span-2 p-4 bg-white dark:bg-zinc-50">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 inline-flex items-center gap-1.5">
                <Cpu className="size-3" />
                Program
                <span className="text-zinc-400">·</span>
                <span className="font-mono text-zinc-700 normal-case tracking-normal">
                  {telem.programIndex + 1}/{PROGRAM.length}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px] gap-1 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
                onClick={() => setProgramOpen(true)}
              >
                <Maximize2 className="size-3" /> Tüm Program
              </Button>
            </div>
            <ProgramWindow lines={PROGRAM} currentIndex={telem.programIndex} />
          </div>
        </div>

        {/* STATUS GRID (compact, blink when active) */}
        <div className="p-4 border-t">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2.5">
            Durum Göstergeleri
          </div>
          <div className="grid grid-cols-5 lg:grid-cols-[repeat(15,_minmax(0,1fr))] gap-1.5">
            {ALARM_DEFS.map((def) => {
              const active = telem.alarms.includes(def.type);
              return <StatusCard key={def.type} def={def} active={active} />;
            })}
          </div>
        </div>

        {/* HATA LOGLARI */}
        <div className="p-4 border-t">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center justify-between">
            <span>Hata Logları</span>
            <span className="font-mono normal-case tracking-normal text-foreground tabular-nums">
              {telem.alarmHistory.length}
            </span>
          </div>
          {telem.alarmHistory.length === 0 ? (
            <div className="rounded-lg border bg-muted/20 p-3 text-center text-xs text-muted-foreground">
              Henüz hata yok.
            </div>
          ) : (
            <div className="rounded-lg border bg-muted/10 max-h-44 overflow-y-auto divide-y">
              {telem.alarmHistory.map((entry, i) => {
                const def = ALARM_BY_TYPE.get(entry.type);
                if (!def) return null;
                const Icon = def.icon;
                const stillActive = telem.alarms.includes(entry.type);
                return (
                  <div
                    key={`${entry.type}-${entry.raisedAt}-${i}`}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 text-xs",
                      stillActive && "bg-red-500/5",
                    )}
                  >
                    <Icon
                      className={cn(
                        "size-3.5 shrink-0",
                        stillActive ? "text-red-600" : "text-muted-foreground",
                      )}
                    />
                    <span className="font-mono text-[11px] tabular-nums text-muted-foreground w-16 shrink-0">
                      {def.code}
                    </span>
                    <span className="font-medium flex-1 truncate">{def.alertText}</span>
                    {stillActive && (
                      <Badge
                        variant="outline"
                        className="h-5 text-[10px] bg-red-500/10 text-red-700 border-red-500/40 font-bold"
                      >
                        AKTİF
                      </Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                      {Math.max(0, Math.round((Date.now() - entry.raisedAt) / 1000))} sn
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer note */}
        <div className="px-4 pb-3 text-[10px] text-muted-foreground italic">
          ⓘ Mock veri — gerçek MTConnect / FOCAS adaptörü bağlandığında otomatik
          canlı veriye geçecek.
        </div>
      </CardContent>

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
        "h-16 rounded-md border flex flex-col items-center justify-center gap-1 px-1 transition relative",
        active
          ? "animate-blink-alarm shadow-sm"
          : "bg-muted/30 border-border hover:bg-muted/50",
      )}
      title={`${def.code} · ${def.label}`}
    >
      <Icon
        className={cn(
          "size-4 shrink-0",
          active ? "text-red-700" : "text-muted-foreground/60",
        )}
      />
      <div
        className={cn(
          "text-[9px] font-semibold leading-none text-center truncate w-full",
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
  const window = 10;
  const half = Math.floor(window / 2);
  let start = Math.max(0, currentIndex - half);
  if (start + window > lines.length) start = Math.max(0, lines.length - window);
  const visible = lines.slice(start, start + window);

  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50/60 font-mono text-[11px] overflow-hidden">
      {visible.map((line, i) => {
        const idx = start + i;
        const isCurrent = idx === currentIndex;
        return (
          <div
            key={idx}
            className={cn(
              "flex items-center gap-2 px-2.5 py-1 leading-tight border-l-2",
              isCurrent
                ? "bg-emerald-100 text-emerald-900 border-l-emerald-500 font-semibold"
                : "border-l-transparent text-zinc-700 hover:bg-zinc-100",
            )}
          >
            <span
              className={cn(
                "tabular-nums w-7 text-right shrink-0",
                isCurrent ? "text-emerald-700" : "text-zinc-400",
              )}
            >
              {idx + 1}
            </span>
            <span className="truncate">
              {isCurrent && <span className="mr-1 text-emerald-600">▸</span>}
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

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => {
        currentLineRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 80);
      return () => clearTimeout(t);
    }
  }, [open, currentIndex]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0 bg-white">
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

        <div className="overflow-y-auto bg-white text-zinc-900 font-mono text-xs flex-1">
          {lines.map((line, idx) => {
            const isCurrent = idx === currentIndex;
            return (
              <div
                key={idx}
                ref={isCurrent ? currentLineRef : undefined}
                className={cn(
                  "flex items-center gap-3 px-4 py-1.5 leading-tight border-l-4",
                  isCurrent
                    ? "bg-emerald-100 text-emerald-900 border-l-emerald-500 font-semibold"
                    : "border-l-transparent text-zinc-700 hover:bg-zinc-50",
                )}
              >
                <span
                  className={cn(
                    "tabular-nums w-12 text-right shrink-0",
                    isCurrent ? "text-emerald-700" : "text-zinc-400",
                  )}
                >
                  {idx + 1}
                </span>
                <span className="truncate">
                  {isCurrent && <span className="mr-1 text-emerald-600">▸</span>}
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
  accent,
  primary = false,
  small = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  unit: string;
  accent: "emerald" | "amber" | "red" | "blue" | "violet" | "zinc";
  primary?: boolean;
  small?: boolean;
}) {
  const tones = {
    emerald: { iconBg: "bg-emerald-500/10 text-emerald-600", value: "text-emerald-700" },
    amber:   { iconBg: "bg-amber-500/10 text-amber-600",     value: "text-amber-700" },
    red:     { iconBg: "bg-red-500/10 text-red-600",         value: "text-red-700" },
    blue:    { iconBg: "bg-blue-500/10 text-blue-600",       value: "text-blue-700" },
    violet:  { iconBg: "bg-violet-500/10 text-violet-600",   value: "text-violet-700" },
    zinc:    { iconBg: "bg-zinc-500/10 text-zinc-600",       value: "text-zinc-700" },
  } as const;
  const t = tones[accent];
  return (
    <div className="rounded-xl border bg-card p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-center gap-2 mb-3">
        <div className={cn("size-8 rounded-lg flex items-center justify-center", t.iconBg)}>
          <Icon className="size-4" />
        </div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
      </div>
      <div className="flex items-baseline gap-1.5 min-h-[2.5rem]">
        <span
          className={cn(
            "font-bold tabular-nums leading-none tracking-tight",
            small ? "text-base" : "text-3xl",
            primary ? "text-foreground" : t.value,
          )}
        >
          {value}
        </span>
        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      </div>
    </div>
  );
}
