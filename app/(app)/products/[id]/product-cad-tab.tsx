"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Box,
  Code2,
  Download,
  FileCode,
  FileText,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import {
  CAD_FILE_KIND_LABEL,
  detectCadFileKind,
  type Machine,
} from "@/lib/supabase/types";
import {
  deleteCadProgram,
  getCadSignedUrl,
  uploadCadProgram,
} from "../../cad-cam/actions";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface CadItem {
  id: string;
  title: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  revision: string | null;
  created_at: string;
}

function fileSizeLabel(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ProductCadTab({
  productId,
  items,
  machines,
}: {
  productId: string;
  items: CadItem[];
  machines: Pick<Machine, "id" | "name">[];
}) {
  const router = useRouter();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  function downloadOne(path: string, filename: string) {
    startTransition(async () => {
      const r = await getCadSignedUrl(path);
      if ("error" in r && r.error) {
        toast.error(r.error);
        return;
      }
      const url = "url" in r ? r.url : null;
      if (!url) return;
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
  }

  function removeOne(id: string, path: string, title: string) {
    if (!confirm(`'${title}' silinsin mi?`)) return;
    setBusyId(id);
    startTransition(async () => {
      const r = await deleteCadProgram(id, path);
      setBusyId(null);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Silindi");
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="text-xs text-muted-foreground">
            NC / G-code / STEP / STL / DXF / post-processor çıktıları.
          </div>
          <Button onClick={() => setUploadOpen(true)} size="sm" className="gap-1.5">
            <Plus className="size-3.5" /> CAD/CAM Yükle
          </Button>
        </div>

        {items.length === 0 ? (
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className={cn(
              "w-full rounded-lg border-2 border-dashed bg-card/40 hover:bg-card transition",
              "py-12 flex flex-col items-center justify-center gap-2 cursor-pointer",
            )}
          >
            <Upload className="size-7 text-muted-foreground" />
            <div className="text-sm font-medium">İlk programı yükle</div>
            <div className="text-xs text-muted-foreground">
              .NC .TAP .GCODE .STEP .STL .DXF .PDF · maks 50 MB
            </div>
          </button>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {items.map((c) => {
              const kindKey = detectCadFileKind(c.file_type, c.file_path);
              const Icon =
                kindKey === "gcode"
                  ? FileCode
                  : kindKey === "cad"
                    ? Box
                    : kindKey === "pdf"
                      ? FileText
                      : Code2;
              const fileName = (c.file_path.split("/").pop() ?? "").replace(
                /^\d+_/,
                "",
              );
              const tone =
                kindKey === "gcode"
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                  : kindKey === "cad"
                    ? "bg-blue-500/15 text-blue-700 dark:text-blue-300"
                    : "bg-muted text-muted-foreground";
              return (
                <li
                  key={c.id}
                  className="group flex items-center gap-3 px-3 py-2 rounded-lg border bg-card hover:bg-muted/30 transition"
                >
                  <div
                    className={cn(
                      "size-9 rounded-md flex items-center justify-center shrink-0",
                      tone,
                    )}
                  >
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate flex items-center gap-1.5">
                      {c.title}
                      <Badge variant="outline" className="text-[9px]">
                        {CAD_FILE_KIND_LABEL[kindKey]}
                      </Badge>
                      {c.revision && (
                        <Badge variant="outline" className="text-[9px]">
                          Rev. {c.revision}
                        </Badge>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {fileName} · {fileSizeLabel(c.file_size)} ·{" "}
                      {formatDate(c.created_at)}
                    </div>
                  </div>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => downloadOne(c.file_path, fileName)}
                      disabled={pending}
                      className="size-8"
                      title="İndir"
                    >
                      <Download className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeOne(c.id, c.file_path, c.title)}
                      disabled={busyId === c.id}
                      className="size-8 text-red-600 hover:text-red-600 hover:bg-red-500/10"
                      title="Sil"
                    >
                      {busyId === c.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="size-3.5" />
                      )}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      <CadUploadDialog
        productId={productId}
        machines={machines}
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUploaded={() => {
          setUploadOpen(false);
          router.refresh();
        }}
      />
    </Card>
  );
}

function CadUploadDialog({
  productId,
  machines,
  open,
  onOpenChange,
  onUploaded,
}: {
  productId: string;
  machines: Pick<Machine, "id" | "name">[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onUploaded: () => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [title, setTitle] = useState("");
  const [machineId, setMachineId] = useState("none");
  const [revision, setRevision] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();

  function reset() {
    setTitle("");
    setMachineId("none");
    setRevision("");
    setNotes("");
    if (fileRef.current) fileRef.current.value = "";
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("Dosya seçilmedi");
      return;
    }
    if (!title.trim()) {
      toast.error("Başlık zorunlu");
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    fd.append("title", title.trim());
    fd.append("product_id", productId);
    if (machineId !== "none") fd.append("machine_id", machineId);
    fd.append("revision", revision);
    fd.append("notes", notes);
    startTransition(async () => {
      const r = await uploadCadProgram(fd);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Program yüklendi");
      reset();
      onUploaded();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>CAD/CAM Programı Yükle</DialogTitle>
          <DialogDescription>Bu ürüne bağlanır.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="c-file">Dosya *</Label>
            <Input
              id="c-file"
              ref={fileRef}
              type="file"
              accept=".nc,.tap,.gcode,.ngc,.iso,.eia,.cnc,.mpf,.step,.stp,.stl,.dxf,.dwg,.iges,.igs,application/pdf"
              required
            />
            <p className="text-[10px] text-muted-foreground">
              Maks 50 MB · NC / G-code / STEP / STL / DXF / PDF
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="c-title">Başlık *</Label>
              <Input
                id="c-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="O0001 - Tornalama"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-rev">Revizyon</Label>
              <Input
                id="c-rev"
                value={revision}
                onChange={(e) => setRevision(e.target.value)}
                placeholder="01"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-machine">Makine (opsiyonel)</Label>
            <Select value={machineId} onValueChange={setMachineId}>
              <SelectTrigger id="c-machine">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Yok —</SelectItem>
                {machines.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-notes">Notlar</Label>
            <Input
              id="c-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opsiyonel"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              İptal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Yükle
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
