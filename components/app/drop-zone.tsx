"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { UploadCloud } from "lucide-react";
import { toast } from "sonner";

/**
 * Reusable file drop overlay. Wraps any region of the page; while a file
 * is being dragged from the desktop, an accent-colored overlay appears
 * with a hint text. On drop, the wrapped `onFiles(files)` is invoked.
 *
 * Security:
 *  - The component validates each dropped file against `accept` (extension
 *    or MIME prefix list) and `maxSize` (bytes) BEFORE calling onFiles.
 *  - Files that fail validation are reported via toast and dropped from
 *    the batch — they never reach the upload pipeline.
 *  - We do NOT trust the browser-reported MIME by itself; consumers
 *    should re-validate server-side (via the bucket's storage policy and
 *    by checking the saved row's mime_type column).
 *  - `accept` should be a *whitelist*. Default is empty (=accept all),
 *    but every consumer in this app passes a tight list.
 */
interface Props {
  onFiles: (files: File[]) => void;
  /** Whitelist of extensions (".pdf", ".png") and/or MIME prefixes
   *  ("image/", "application/pdf"). Empty = accept all (not recommended). */
  accept?: string[];
  /** Max bytes per file. Default 25 MB. */
  maxSize?: number;
  /** Allow multiple files at once. Default true. */
  multiple?: boolean;
  /** Hint shown in the overlay. */
  hint?: string;
  /** Disable the drop zone entirely. */
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}

const DEFAULT_MAX = 25 * 1024 * 1024;

function fileMatches(file: File, accept: string[]): boolean {
  if (accept.length === 0) return true;
  const name = file.name.toLowerCase();
  const mime = (file.type || "").toLowerCase();
  for (const rule of accept) {
    const r = rule.toLowerCase();
    if (r.startsWith(".") && name.endsWith(r)) return true;
    if (r.endsWith("/") && mime.startsWith(r)) return true;
    if (mime === r) return true;
  }
  return false;
}

export function DropZone({
  onFiles,
  accept = [],
  maxSize = DEFAULT_MAX,
  multiple = true,
  hint = "Dosyaları buraya bırak",
  disabled,
  className,
  children,
}: Props) {
  const [isOver, setIsOver] = useState(false);
  const dragCounter = useRef(0);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Use a counter so nested elements don't toggle on/off as the cursor
  // crosses children — only flip when the cursor leaves the wrapper.
  const onDragEnter = useCallback(
    (e: DragEvent) => {
      if (disabled) return;
      // Only react to actual file drags (not text selections etc.)
      if (!e.dataTransfer?.types?.includes("Files")) return;
      dragCounter.current += 1;
      setIsOver(true);
      e.preventDefault();
    },
    [disabled],
  );

  const onDragLeave = useCallback(
    (e: DragEvent) => {
      if (disabled) return;
      dragCounter.current = Math.max(0, dragCounter.current - 1);
      if (dragCounter.current === 0) setIsOver(false);
      e.preventDefault();
    },
    [disabled],
  );

  const onDragOver = useCallback(
    (e: DragEvent) => {
      if (disabled) return;
      if (!e.dataTransfer?.types?.includes("Files")) return;
      e.preventDefault();
    },
    [disabled],
  );

  const onDrop = useCallback(
    (e: DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      dragCounter.current = 0;
      setIsOver(false);
      const list = e.dataTransfer?.files;
      if (!list || list.length === 0) return;
      let arr = Array.from(list);
      if (!multiple && arr.length > 1) arr = arr.slice(0, 1);

      const valid: File[] = [];
      for (const f of arr) {
        if (f.size === 0) {
          toast.error(`${f.name}: Boş dosya.`);
          continue;
        }
        if (f.size > maxSize) {
          toast.error(
            `${f.name}: ${(f.size / 1024 / 1024).toFixed(1)} MB · max ${(
              maxSize /
              1024 /
              1024
            ).toFixed(0)} MB`,
          );
          continue;
        }
        if (!fileMatches(f, accept)) {
          toast.error(`${f.name}: Bu dosya türü kabul edilmiyor.`);
          continue;
        }
        valid.push(f);
      }
      if (valid.length > 0) onFiles(valid);
    },
    [accept, maxSize, multiple, disabled, onFiles],
  );

  // We listen on the wrapper, not on window — this way several drop
  // zones can coexist on the same page without fighting each other.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    el.addEventListener("dragenter", onDragEnter);
    el.addEventListener("dragleave", onDragLeave);
    el.addEventListener("dragover", onDragOver);
    el.addEventListener("drop", onDrop);
    return () => {
      el.removeEventListener("dragenter", onDragEnter);
      el.removeEventListener("dragleave", onDragLeave);
      el.removeEventListener("dragover", onDragOver);
      el.removeEventListener("drop", onDrop);
    };
  }, [onDragEnter, onDragLeave, onDragOver, onDrop]);

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      {children}
      {isOver && (
        <div
          className={cn(
            "pointer-events-none absolute inset-0 z-50",
            "rounded-lg border-2 border-dashed border-primary bg-primary/10",
            "flex items-center justify-center backdrop-blur-sm",
            "animate-tg-fade-in",
          )}
          aria-hidden
        >
          <div className="bg-card border rounded-xl shadow-xl px-5 py-4 flex items-center gap-3">
            <UploadCloud className="size-7 text-primary" />
            <div>
              <div className="font-semibold text-sm">{hint}</div>
              <div className="text-[11px] text-muted-foreground">
                Maks {(maxSize / 1024 / 1024).toFixed(0)} MB
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
