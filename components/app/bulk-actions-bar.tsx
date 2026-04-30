"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, X, CheckSquare } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Sticky toolbar that appears when at least one row is selected.
 * Pattern matches Gmail / Outlook / GitHub: count + actions + close.
 *
 * Renders nothing when `count === 0` so it can sit unconditionally
 * at the top of any list view.
 */
interface Props {
  count: number;
  total: number;
  onSelectAll: () => void;
  onClear: () => void;
  /** Server action that performs the bulk delete. Receives an array of
   *  ids and returns either { success } or { error }. */
  onDelete: (ids: string[]) => Promise<{ success?: boolean; error?: string }>;
  ids: string[];
  /** Singular Turkish noun used in confirm + toast messages, e.g. "takım". */
  itemLabel: string;
  /** Optional extra actions rendered between count and delete. */
  children?: React.ReactNode;
}

export function BulkActionsBar({
  count,
  total,
  onSelectAll,
  onClear,
  onDelete,
  ids,
  itemLabel,
  children,
}: Props) {
  const [pending, startTransition] = useTransition();
  if (count === 0) return null;

  function handleDelete() {
    const msg = `${count} ${itemLabel} kalıcı olarak silinsin mi?\n\nBu işlem geri alınamaz.`;
    if (!confirm(msg)) return;
    startTransition(async () => {
      const r = await onDelete(ids);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(`${count} ${itemLabel} silindi`);
      onClear();
    });
  }

  return (
    <div
      className={cn(
        "sticky top-2 z-20 mb-3 mx-auto max-w-3xl",
        "rounded-full border bg-card/95 backdrop-blur-md shadow-lg",
        "px-3 py-1.5 flex items-center gap-2 animate-tg-fade-in",
      )}
    >
      <span className="size-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-bold tabular-nums shrink-0">
        {count}
      </span>
      <span className="text-sm font-medium">
        seçili
        {total > 0 && (
          <span className="text-muted-foreground font-normal ml-1">
            / {total}
          </span>
        )}
      </span>

      <div className="h-5 w-px bg-border mx-1" />

      {count < total && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onSelectAll}
          className="h-7 px-2 text-xs gap-1"
        >
          <CheckSquare className="size-3.5" />
          Tümünü seç
        </Button>
      )}

      {children}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleDelete}
        disabled={pending}
        className="h-7 px-2.5 text-xs gap-1 text-red-700 hover:text-red-700 hover:bg-red-500/10 ml-auto"
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Trash2 className="size-3.5" />
        )}
        Sil
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onClear}
        className="size-7 shrink-0"
        title="Seçimi temizle"
        aria-label="Seçimi temizle"
      >
        <X className="size-3.5" />
      </Button>
    </div>
  );
}
