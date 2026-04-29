"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Trash2,
  Wrench,
  Search,
  Check,
  ChevronDown,
} from "lucide-react";
import { setJobTools, type JobToolInput } from "./actions";
import { createClient } from "@/lib/supabase/client";
import type { Tool } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

interface ExistingJobTool {
  tool_id: string;
  quantity_used: number;
  notes: string | null;
}

interface Props {
  jobId: string;
  jobLabel: string;
  trigger: React.ReactNode;
}

type Row = JobToolInput & { _key: string };

function rowKey() {
  return Math.random().toString(36).slice(2);
}

export function JobToolsDialog({ jobId, jobLabel, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [tools, setTools] = useState<Tool[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  // Bulk picker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerSelected, setPickerSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const supabase = createClient();
    Promise.all([
      supabase.from("tools").select("*").order("name"),
      supabase
        .from("job_tools")
        .select("tool_id, quantity_used, notes")
        .eq("job_id", jobId),
    ])
      .then(([toolsRes, jtRes]) => {
        setTools((toolsRes.data ?? []) as Tool[]);
        const existing = (jtRes.data ?? []) as ExistingJobTool[];
        setRows(
          existing.map((e) => ({
            _key: rowKey(),
            tool_id: e.tool_id,
            quantity_used: e.quantity_used,
            notes: e.notes,
          })),
        );
      })
      .finally(() => setLoading(false));
  }, [open, jobId]);

  // Reset picker state whenever the picker is closed/dialog is closed
  useEffect(() => {
    if (!pickerOpen) {
      setPickerSearch("");
      setPickerSelected(new Set());
    }
  }, [pickerOpen]);

  function updateRow(key: string, patch: Partial<Row>) {
    setRows((p) => p.map((r) => (r._key === key ? { ...r, ...patch } : r)));
  }

  function removeRow(key: string) {
    setRows((p) => p.filter((r) => r._key !== key));
  }

  // Tools currently in `rows` — used to exclude from the picker.
  const usedToolIds = useMemo(
    () => new Set(rows.map((r) => r.tool_id).filter(Boolean)),
    [rows],
  );

  // Filter the picker list by search and exclude already-added tools.
  const pickerList = useMemo(() => {
    const q = pickerSearch.trim().toLocaleLowerCase("tr");
    return tools.filter((t) => {
      if (usedToolIds.has(t.id)) return false;
      if (!q) return true;
      const hay = [t.name, t.code, t.size, t.location, t.type, t.supplier]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr");
      return hay.includes(q);
    });
  }, [tools, usedToolIds, pickerSearch]);

  function togglePickerOne(id: string) {
    setPickerSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllPickerVisible() {
    setPickerSelected((prev) => {
      const next = new Set(prev);
      for (const t of pickerList) next.add(t.id);
      return next;
    });
  }
  function clearPickerSelection() {
    setPickerSelected(new Set());
  }

  function addSelected() {
    if (pickerSelected.size === 0) {
      toast.error("Önce en az bir takım seç.");
      return;
    }
    setRows((prev) => [
      ...prev,
      ...Array.from(pickerSelected).map((tool_id) => ({
        _key: rowKey(),
        tool_id,
        quantity_used: 1,
        notes: null,
      })),
    ]);
    toast.success(`${pickerSelected.size} takım eklendi`);
    setPickerOpen(false);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Validate: no duplicate tool_id, all rows have a tool selected
    const seen = new Set<string>();
    for (const r of rows) {
      if (!r.tool_id) {
        toast.error("Tüm satırlar için takım seç.");
        return;
      }
      if (seen.has(r.tool_id)) {
        toast.error("Aynı takım birden fazla kez eklenemez.");
        return;
      }
      seen.add(r.tool_id);
    }
    startTransition(async () => {
      const r = await setJobTools(
        jobId,
        rows.map(({ _key, ...rest }) => {
          void _key;
          return rest;
        }),
      );
      if (r.error) toast.error(r.error);
      else {
        toast.success("Takımlar kaydedildi");
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Takım Ata</DialogTitle>
          <DialogDescription>
            <span className="font-medium">{jobLabel}</span> işinde kullanılacak
            takımlar ve adetleri.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-3">
          {loading ? (
            <div className="py-8 flex items-center justify-center text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              <Wrench className="size-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">
                Henüz takım atanmadı. Aşağıdan{" "}
                <span className="font-medium text-foreground">+ Takım Ekle</span>{" "}
                ile birden fazla takım seçebilirsin.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {rows.map((r) => {
                const selected = tools.find((t) => t.id === r.tool_id);
                return (
                  <div
                    key={r._key}
                    className="grid grid-cols-12 gap-2 items-center p-2 rounded-lg border bg-muted/20"
                  >
                    <div className="col-span-12 sm:col-span-7 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {selected?.name ?? "—"}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                        {selected?.code && (
                          <span className="font-mono">{selected.code}</span>
                        )}
                        {selected?.size && <span>· {selected.size}</span>}
                        {selected?.location && (
                          <Badge
                            variant="outline"
                            className="font-normal h-4 px-1.5"
                          >
                            {selected.location}
                          </Badge>
                        )}
                        {selected && <span>Stok: {selected.quantity}</span>}
                      </div>
                    </div>
                    <div className="col-span-7 sm:col-span-3">
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        value={r.quantity_used}
                        onChange={(e) =>
                          updateRow(r._key, {
                            quantity_used: Number(e.target.value) || 1,
                          })
                        }
                        placeholder="Adet"
                        className="h-9 tabular-nums"
                      />
                    </div>
                    <div className="col-span-4 sm:col-span-1 flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">
                        adet
                      </span>
                    </div>
                    <div className="col-span-1 flex items-center justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRow(r._key)}
                        title="Kaldır"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Bulk tool picker ── */}
          <div className="rounded-lg border bg-card">
            <button
              type="button"
              onClick={() => setPickerOpen((v) => !v)}
              disabled={tools.length === 0 || rows.length >= tools.length}
              className={cn(
                "w-full flex items-center justify-between gap-2 px-3 py-2.5",
                "text-sm font-medium transition",
                "hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed",
                pickerOpen && "border-b",
              )}
            >
              <span className="flex items-center gap-2">
                <Plus className="size-4" />
                {pickerOpen ? "Takım Ekle Paneli Açık" : "+ Takım Ekle (Toplu)"}
              </span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                {rows.length >= tools.length && tools.length > 0
                  ? "Tüm takımlar eklendi"
                  : `${tools.length - rows.length} eklenebilir`}
                <ChevronDown
                  className={cn(
                    "size-4 transition-transform",
                    pickerOpen && "rotate-180",
                  )}
                />
              </span>
            </button>

            {pickerOpen && (
              <div className="p-3 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    value={pickerSearch}
                    onChange={(e) => setPickerSearch(e.target.value)}
                    placeholder="Takım ara: ad, kod, ölçü, konum…"
                    className="pl-9 h-9"
                    autoFocus
                  />
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground tabular-nums">
                    {pickerList.length} sonuç ·{" "}
                    <span className="font-bold text-foreground">
                      {pickerSelected.size}
                    </span>{" "}
                    seçili
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={selectAllPickerVisible}
                      disabled={pickerList.length === 0}
                      className="text-primary hover:underline disabled:opacity-40 disabled:no-underline"
                    >
                      Görünür hepsini seç
                    </button>
                    <span className="text-muted-foreground">·</span>
                    <button
                      type="button"
                      onClick={clearPickerSelection}
                      disabled={pickerSelected.size === 0}
                      className="text-muted-foreground hover:underline disabled:opacity-40 disabled:no-underline"
                    >
                      Temizle
                    </button>
                  </div>
                </div>

                <div className="rounded-md border max-h-72 overflow-y-auto divide-y">
                  {pickerList.length === 0 ? (
                    <div className="p-6 text-center text-sm text-muted-foreground">
                      {pickerSearch
                        ? "Aramayla eşleşen takım yok."
                        : "Eklenebilecek takım yok."}
                    </div>
                  ) : (
                    pickerList.map((t) => {
                      const checked = pickerSelected.has(t.id);
                      return (
                        <label
                          key={t.id}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 cursor-pointer",
                            "transition hover:bg-muted/60",
                            checked && "bg-primary/5",
                          )}
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => togglePickerOne(t.id)}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate">
                              {t.name}
                            </div>
                            <div className="text-[10px] text-muted-foreground flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                              {t.code && (
                                <span className="font-mono">{t.code}</span>
                              )}
                              {t.size && <span>· {t.size}</span>}
                              {t.type && <span>· {t.type}</span>}
                              {t.location && (
                                <Badge
                                  variant="outline"
                                  className="font-normal h-4 px-1.5"
                                >
                                  {t.location}
                                </Badge>
                              )}
                              <span>Stok: {t.quantity}</span>
                            </div>
                          </div>
                          {checked && (
                            <Check className="size-4 text-primary shrink-0" />
                          )}
                        </label>
                      );
                    })
                  )}
                </div>

                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setPickerOpen(false)}
                  >
                    Kapat
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={addSelected}
                    disabled={pickerSelected.size === 0}
                  >
                    <Plus className="size-4" />
                    Seçilenleri Ekle ({pickerSelected.size})
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              İptal
            </Button>
            <Button type="submit" disabled={pending || loading}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Kaydet
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
