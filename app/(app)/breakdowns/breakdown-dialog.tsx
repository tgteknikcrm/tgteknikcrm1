"use client";

import { useState, useTransition, useRef } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Image from "next/image";
import { toast } from "sonner";
import { Loader2, Plus, ImagePlus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createBreakdown } from "./actions";
import {
  TIMELINE_KIND_LABEL,
  timelinePhotoUrl,
  type TimelineEntryKind,
} from "@/lib/supabase/types";

const KINDS: TimelineEntryKind[] = [
  "ariza",
  "duzeltme",
  "parca_degisimi",
  "bakim",
  "temizlik",
  "gozlem",
];

const SEVERITY = [
  { value: 0, label: "Düşük" },
  { value: 1, label: "Orta" },
  { value: 2, label: "Yüksek" },
  { value: 3, label: "Kritik" },
];

export function BreakdownDialog({
  machines,
}: {
  machines: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startSave] = useTransition();
  const [machineId, setMachineId] = useState("");
  const [kind, setKind] = useState<TimelineEntryKind>("ariza");
  const [severity, setSeverity] = useState<number>(1);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [duration, setDuration] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setMachineId("");
    setKind("ariza");
    setSeverity(1);
    setTitle("");
    setBody("");
    setDuration("");
    setPhotos([]);
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Giriş yapılmamış");
        return;
      }
      const uploaded: string[] = [];
      for (const f of files) {
        if (!f.type.startsWith("image/") || f.size > 8 * 1024 * 1024) {
          toast.error(`'${f.name}' atlandı`);
          continue;
        }
        const safe = f.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
        const path = `${user.id}/${machineId || "noref"}/${Date.now()}_${safe}`;
        const { error } = await supabase.storage
          .from("timeline-photos")
          .upload(path, f, { contentType: f.type });
        if (!error) uploaded.push(path);
      }
      setPhotos((prev) => [...prev, ...uploaded]);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!machineId) {
      toast.error("Önce makine seç");
      return;
    }
    if (!title.trim()) {
      toast.error("Başlık gerekli");
      return;
    }
    startSave(async () => {
      const r = await createBreakdown({
        machine_id: machineId,
        kind,
        title: title.trim(),
        body: body.trim() || undefined,
        severity_level: severity as 0 | 1 | 2 | 3,
        duration_minutes: duration ? Number(duration) : undefined,
        photo_paths: photos,
      });
      if (r.error) toast.error(r.error);
      else {
        toast.success("Kayıt oluşturuldu");
        reset();
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> Yeni Arıza / Bakım
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Yeni Arıza / Bakım Kaydı</DialogTitle>
          <DialogDescription>
            Arıza, düzeltme, parça değişimi, bakım, temizlik. Önem seviyesi ve
            fotoğraf eklenebilir.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="bd-machine">Makine *</Label>
              <Select value={machineId} onValueChange={setMachineId}>
                <SelectTrigger id="bd-machine">
                  <SelectValue placeholder="Seç" />
                </SelectTrigger>
                <SelectContent>
                  {machines.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bd-kind">Tip *</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as TimelineEntryKind)}>
                <SelectTrigger id="bd-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {TIMELINE_KIND_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="bd-severity">Önem</Label>
              <Select
                value={String(severity)}
                onValueChange={(v) => setSeverity(Number(v))}
              >
                <SelectTrigger id="bd-severity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEVERITY.map((s) => (
                    <SelectItem key={s.value} value={String(s.value)}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bd-duration">Süre (dakika)</Label>
              <Input
                id="bd-duration"
                type="number"
                min={0}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="ör. 45"
                className="tabular-nums"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bd-title">Başlık *</Label>
            <Input
              id="bd-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ör. Spindle aşırı ısınması"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bd-body">Açıklama</Label>
            <Textarea
              id="bd-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              placeholder="Detaylar, semptomlar, etkilenen iş..."
            />
          </div>

          <div className="space-y-1.5">
            <Label>Fotoğraflar</Label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={onFileChange}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full"
            >
              {uploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ImagePlus className="size-4" />
              )}
              Fotoğraf Ekle ({photos.length})
            </Button>
            {photos.length > 0 && (
              <div className="flex gap-1.5 flex-wrap mt-1">
                {photos.map((p) => {
                  const url = timelinePhotoUrl(p);
                  return (
                    <div
                      key={p}
                      className="relative size-16 rounded-md border overflow-hidden bg-muted"
                    >
                      {url && (
                        <Image
                          src={url}
                          alt=""
                          width={64}
                          height={64}
                          className="size-full object-cover"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => setPhotos((prev) => prev.filter((x) => x !== p))}
                        className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset();
                setOpen(false);
              }}
            >
              İptal
            </Button>
            <Button type="submit" disabled={pending || uploading}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Kaydet
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
