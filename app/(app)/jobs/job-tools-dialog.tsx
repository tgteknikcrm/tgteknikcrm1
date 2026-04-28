"use client";

import { useEffect, useState, useTransition } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Wrench } from "lucide-react";
import { setJobTools, type JobToolInput } from "./actions";
import { createClient } from "@/lib/supabase/client";
import type { Tool } from "@/lib/supabase/types";

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

  function addRow() {
    setRows((p) => [
      ...p,
      { _key: rowKey(), tool_id: "", quantity_used: 1, notes: null },
    ]);
  }

  function updateRow(key: string, patch: Partial<Row>) {
    setRows((p) => p.map((r) => (r._key === key ? { ...r, ...patch } : r)));
  }

  function removeRow(key: string) {
    setRows((p) => p.filter((r) => r._key !== key));
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

  // Tools that aren't already selected (avoid duplicates in dropdowns)
  function availableTools(currentToolId: string) {
    const used = new Set(rows.map((r) => r.tool_id).filter(Boolean));
    return tools.filter((t) => t.id === currentToolId || !used.has(t.id));
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
                Henüz takım atanmadı.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {rows.map((r) => {
                const available = availableTools(r.tool_id);
                const selected = tools.find((t) => t.id === r.tool_id);
                return (
                  <div
                    key={r._key}
                    className="grid grid-cols-12 gap-2 items-start p-2 rounded-lg border bg-muted/20"
                  >
                    <div className="col-span-12 sm:col-span-7">
                      <Select
                        value={r.tool_id}
                        onValueChange={(v) => updateRow(r._key, { tool_id: v })}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Takım seç" />
                        </SelectTrigger>
                        <SelectContent>
                          {available.length === 0 ? (
                            <div className="px-2 py-1.5 text-xs text-muted-foreground">
                              Tüm takımlar zaten eklendi.
                            </div>
                          ) : (
                            available.map((t) => (
                              <SelectItem key={t.id} value={t.id}>
                                <span className="font-medium">{t.name}</span>
                                {t.code && (
                                  <span className="text-xs text-muted-foreground ml-1.5 font-mono">
                                    {t.code}
                                  </span>
                                )}
                                {t.size && (
                                  <span className="text-xs text-muted-foreground ml-1.5">
                                    · {t.size}
                                  </span>
                                )}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      {selected && (
                        <div className="text-[10px] text-muted-foreground mt-1 flex gap-2">
                          {selected.location && (
                            <Badge variant="outline" className="font-normal h-4 px-1.5">
                              {selected.location}
                            </Badge>
                          )}
                          <span>Stok: {selected.quantity}</span>
                        </div>
                      )}
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
                      <span className="text-xs text-muted-foreground">adet</span>
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

          <Button
            type="button"
            variant="outline"
            onClick={addRow}
            disabled={tools.length === 0 || rows.length >= tools.length}
            className="w-full"
          >
            <Plus className="size-4" /> Takım Ekle
          </Button>

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
