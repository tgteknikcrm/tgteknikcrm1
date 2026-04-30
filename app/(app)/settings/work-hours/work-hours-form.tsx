"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Save, Coffee, Clock } from "lucide-react";
import { toast } from "sonner";
import {
  DAY_LABELS_TR,
  type WorkSchedule,
  type WorkScheduleDay,
} from "@/lib/supabase/types";
import { saveWorkSchedule } from "./actions";
import { cn } from "@/lib/utils";

export function WorkHoursForm({ initial }: { initial: WorkSchedule }) {
  const router = useRouter();
  const [days, setDays] = useState<WorkScheduleDay[]>(initial.days);
  const [pending, startTransition] = useTransition();

  function update(day: number, patch: Partial<WorkScheduleDay>) {
    setDays((prev) =>
      prev.map((d) => (d.day === day ? { ...d, ...patch } : d)),
    );
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r = await saveWorkSchedule({ days });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Çalışma çizelgesi kaydedildi");
      router.refresh();
    });
  }

  // Quick stats
  const enabledCount = days.filter((d) => d.enabled).length;
  const totalWeekMinutes = days
    .filter((d) => d.enabled)
    .reduce((sum, d) => sum + d.work_minutes, 0);

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {/* Top summary */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4 flex items-center gap-3 flex-wrap">
          <div className="size-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
            <Clock className="size-5" />
          </div>
          <div>
            <div className="text-sm font-bold">Haftalık Toplam Net Çalışma</div>
            <div className="text-xs text-muted-foreground">
              {enabledCount} açık gün · {Math.floor(totalWeekMinutes / 60)} saat{" "}
              {totalWeekMinutes % 60} dk
            </div>
          </div>
          <Button
            type="submit"
            className="ml-auto"
            disabled={pending}
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            <Save className="size-4" />
            Kaydet
          </Button>
        </CardContent>
      </Card>

      {/* Day rows */}
      <div className="space-y-2">
        {days.map((d) => {
          const total = d.work_minutes + d.lunch_minutes;
          return (
            <Card
              key={d.day}
              className={cn(!d.enabled && "opacity-60")}
            >
              <CardContent className="p-3">
                <div className="grid grid-cols-12 gap-3 items-end">
                  <div className="col-span-12 sm:col-span-3 flex items-center gap-2">
                    <Switch
                      checked={d.enabled}
                      onCheckedChange={(v) => update(d.day, { enabled: !!v })}
                    />
                    <div>
                      <div className="font-semibold text-sm">
                        {DAY_LABELS_TR[d.day]}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {d.enabled ? "Açık" : "Kapalı"}
                      </div>
                    </div>
                  </div>

                  <Field label="Vardiya Başlangıcı" colSpan="col-span-4 sm:col-span-2">
                    <Input
                      type="time"
                      value={d.shift_start}
                      onChange={(e) =>
                        update(d.day, { shift_start: e.target.value })
                      }
                      disabled={!d.enabled}
                      className="tabular-nums"
                    />
                  </Field>

                  <Field
                    label="Çalışma (dk)"
                    hint="net"
                    colSpan="col-span-4 sm:col-span-2"
                  >
                    <Input
                      type="number"
                      min={0}
                      max={1440}
                      step={30}
                      value={d.work_minutes}
                      onChange={(e) =>
                        update(d.day, {
                          work_minutes: Math.max(
                            0,
                            Math.min(1440, Number(e.target.value) || 0),
                          ),
                        })
                      }
                      disabled={!d.enabled}
                      className="tabular-nums"
                    />
                  </Field>

                  <Field
                    label="Yemek/Mola"
                    hint="dk"
                    colSpan="col-span-4 sm:col-span-2"
                  >
                    <Input
                      type="number"
                      min={0}
                      max={300}
                      step={15}
                      value={d.lunch_minutes}
                      onChange={(e) =>
                        update(d.day, {
                          lunch_minutes: Math.max(
                            0,
                            Math.min(300, Number(e.target.value) || 0),
                          ),
                        })
                      }
                      disabled={!d.enabled}
                      className="tabular-nums"
                    />
                  </Field>

                  <div className="col-span-12 sm:col-span-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Toplam Vardiya
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="font-mono font-semibold text-sm">
                        {d.enabled
                          ? `${Math.floor(total / 60)}sa ${total % 60}dk`
                          : "—"}
                      </span>
                      {d.enabled && d.lunch_minutes > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                          <Coffee className="size-3" />
                          {d.lunch_minutes}dk
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="text-[11px] text-muted-foreground bg-muted/40 rounded-lg p-3 border border-dashed">
        <div className="font-semibold text-foreground mb-1">Nasıl çalışır?</div>
        <ul className="list-disc list-inside space-y-0.5">
          <li>
            Net <strong>çalışma</strong> dakikası ETA hesabında kullanılır
            (yemek hariç).
          </li>
          <li>
            <strong>Cumartesi</strong> /{" "}
            <strong>Pazar</strong> mesai yapılacaksa toggle'ı aç, dakikaları
            ayarla.
          </li>
          <li>
            Bu çizelge değişince tüm açık işlerin{" "}
            <strong>tahmini bitiş tarihleri</strong> otomatik güncellenir.
          </li>
        </ul>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  colSpan,
  children,
}: {
  label: string;
  hint?: string;
  colSpan: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`${colSpan} space-y-1`}>
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
        {hint && (
          <span className="font-normal normal-case ml-1">({hint})</span>
        )}
      </div>
      {children}
    </div>
  );
}
