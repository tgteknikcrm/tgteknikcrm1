"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Check, Loader2, RotateCw } from "lucide-react";
import { updateBreakdownStatus, type EntryStatus } from "./actions";

export function StatusButtons({
  entryId,
  currentStatus,
}: {
  entryId: string;
  currentStatus: EntryStatus;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fixNote, setFixNote] = useState("");
  const [pending, startTransition] = useTransition();

  function setStatus(s: EntryStatus, fix?: string) {
    startTransition(async () => {
      const r = await updateBreakdownStatus(entryId, s, fix);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Durum güncellendi");
        setOpen(false);
        setFixNote("");
        router.refresh();
      }
    });
  }

  if (currentStatus === "cozuldu") {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setStatus("acik")}
        disabled={pending}
        className="h-7 px-2 text-xs"
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <RotateCw className="size-3.5" />
        )}
        Yeniden Aç
      </Button>
    );
  }

  return (
    <div className="flex gap-1">
      {currentStatus === "acik" && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setStatus("devam")}
          disabled={pending}
          className="h-7 px-2 text-xs"
        >
          Çalışmaya Başla
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" className="h-7 px-2 text-xs gap-1">
            <Check className="size-3.5" /> Çözüldü
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Çözüm Notu</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="fix-note">Ne yapıldı? (opsiyonel)</Label>
            <Textarea
              id="fix-note"
              value={fixNote}
              onChange={(e) => setFixNote(e.target.value)}
              rows={3}
              placeholder="Yapılan müdahale, değiştirilen parça..."
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false);
                setFixNote("");
              }}
            >
              İptal
            </Button>
            <Button
              onClick={() => setStatus("cozuldu", fixNote)}
              disabled={pending}
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              Onayla
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
