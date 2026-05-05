"use client";

import { useEffect, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  Plus,
  Sparkles,
  Droplets,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  INSPECTION_TYPE_LABEL,
  SHIFT_LABEL,
  type InspectionType,
  type MachineInspection,
} from "@/lib/supabase/types";
import { formatDateTime } from "@/lib/utils";
import { InspectionDialog, InspectionDeleteButton } from "./inspection-dialog";
import { getInspectionPhotoUrls } from "./actions";

interface Props {
  machineId: string;
  type: InspectionType;
  inspections: (MachineInspection & {
    performer?: { full_name: string | null } | null;
  })[];
}

export function InspectionList({ machineId, type, inspections }: Props) {
  const Icon = type === "temizlik" ? Sparkles : Droplets;
  const label = INSPECTION_TYPE_LABEL[type];

  return (
    <div className="space-y-4">
      {/* CTA */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {inspections.length === 0
            ? `Henüz ${label.toLowerCase()} kaydı yok`
            : `Son ${inspections.length} kayıt`}
        </div>
        <InspectionDialog
          machineId={machineId}
          type={type}
          trigger={
            <Button className="gap-1.5">
              <Plus className="size-4" />
              <Icon className="size-4" />
              Yeni {label}
            </Button>
          }
        />
      </div>

      {/* List */}
      {inspections.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed py-12 text-center">
          <Icon className="size-10 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-base font-medium text-muted-foreground">
            İlk {label.toLowerCase()} kaydını ekle
          </p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Kontrol listesi + fotoğraflarla makineye dair durum tutulur
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {inspections.map((insp) => (
            <InspectionRow key={insp.id} inspection={insp} machineId={machineId} />
          ))}
        </ul>
      )}
    </div>
  );
}

function InspectionRow({
  inspection: insp,
  machineId,
}: {
  inspection: MachineInspection & {
    performer?: { full_name: string | null } | null;
  };
  machineId: string;
}) {
  const okCount = insp.items.filter((it) => it.ok).length;
  const naCount = insp.items.filter((it) => it.na).length;
  const failCount = insp.items.length - okCount - naCount;
  const allOk = failCount === 0;

  const initials =
    insp.performer?.full_name
      ?.split(" ")
      .map((s) => s[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() ?? "?";

  return (
    <li
      className={cn(
        "group relative rounded-xl border bg-card p-4",
        allOk
          ? "border-emerald-500/30"
          : failCount > 0
            ? "border-amber-500/40"
            : "",
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar className="size-9 shrink-0">
          <AvatarFallback className="text-xs font-bold bg-primary/15 text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-base">
              {insp.performer?.full_name ?? "—"}
            </span>
            <span className="text-sm text-muted-foreground tabular-nums">
              {formatDateTime(insp.performed_at)}
            </span>
            {insp.shift && (
              <Badge variant="outline" className="text-[11px]">
                {SHIFT_LABEL[insp.shift]}
              </Badge>
            )}
            <Badge
              variant="outline"
              className={cn(
                "text-[11px] gap-1",
                allOk
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                  : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
              )}
            >
              {allOk ? (
                <CheckCircle2 className="size-3" />
              ) : (
                <AlertCircle className="size-3" />
              )}
              {okCount}/{insp.items.length}
              {naCount > 0 && <span className="opacity-60"> · {naCount} N/A</span>}
            </Badge>
            {insp.photo_paths.length > 0 && (
              <Badge variant="outline" className="text-[11px] gap-1">
                <ImageIcon className="size-3" />
                {insp.photo_paths.length}
              </Badge>
            )}
          </div>

          {/* Item summary chips: failed items shown explicitly */}
          {failCount > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {insp.items
                .filter((it) => !it.ok && !it.na)
                .map((it) => (
                  <span
                    key={it.key}
                    className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30"
                  >
                    ⚠ {it.label}
                  </span>
                ))}
            </div>
          )}

          {insp.notes && (
            <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">
              {insp.notes}
            </p>
          )}

          {/* Photo strip */}
          {insp.photo_paths.length > 0 && (
            <PhotoStrip paths={insp.photo_paths} />
          )}
        </div>

        <InspectionDeleteButton
          inspectionId={insp.id}
          machineId={machineId}
          label={`${formatDateTime(insp.performed_at)}`}
        />
      </div>
    </li>
  );
}

function PhotoStrip({ paths }: { paths: string[] }) {
  const [urls, setUrls] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const r = await getInspectionPhotoUrls(paths);
      if (!cancelled) setUrls(r.urls);
    })();
    return () => {
      cancelled = true;
    };
  }, [paths]);

  if (urls === null) {
    return (
      <div className="mt-3 flex gap-2">
        {paths.map((p, i) => (
          <div
            key={i}
            className="size-20 rounded-md border bg-muted animate-pulse"
            data-path={p}
          />
        ))}
      </div>
    );
  }
  if (urls.length === 0) return null;
  return (
    <div className="mt-3 flex gap-2 flex-wrap">
      {urls.map((u, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <a
          key={i}
          href={u}
          target="_blank"
          rel="noreferrer"
          className="size-20 rounded-md border overflow-hidden hover:ring-2 hover:ring-primary transition"
        >
          <img
            src={u}
            alt={`Foto ${i + 1}`}
            className="size-full object-cover"
          />
        </a>
      ))}
    </div>
  );
}
