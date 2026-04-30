"use client";

import { useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, Wrench } from "lucide-react";
import {
  TOOL_CONDITION_LABEL,
  toolImagePublicUrl,
  type Tool,
} from "@/lib/supabase/types";
import { ToolDialog } from "./tool-dialog";
import { DeleteButton } from "../operators/delete-button";
import { bulkDeleteTools, deleteTool } from "./actions";
import { useBulkSelection } from "@/lib/use-bulk-selection";
import { BulkActionsBar } from "@/components/app/bulk-actions-bar";

export function ToolsTable({ tools }: { tools: Tool[] }) {
  const router = useRouter();
  const ids = useMemo(() => tools.map((t) => t.id), [tools]);
  const sel = useBulkSelection(ids);

  return (
    <>
      <BulkActionsBar
        count={sel.size}
        total={ids.length}
        onSelectAll={sel.selectAll}
        onClear={sel.clear}
        ids={sel.ids}
        itemLabel="takım"
        onDelete={async (toDelete) => {
          const r = await bulkDeleteTools(toDelete);
          router.refresh();
          return r;
        }}
      />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={
                  sel.allSelected ? true : sel.someSelected ? "indeterminate" : false
                }
                onCheckedChange={(v) => (v ? sel.selectAll() : sel.clear())}
                aria-label="Tümünü seç"
              />
            </TableHead>
            <TableHead className="w-14"></TableHead>
            <TableHead>Kod</TableHead>
            <TableHead>İsim</TableHead>
            <TableHead>Tip / Ölçü</TableHead>
            <TableHead>Konum</TableHead>
            <TableHead className="text-right">Stok</TableHead>
            <TableHead>Durum</TableHead>
            <TableHead className="text-right">İşlem</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tools.map((t) => {
            const low = t.quantity <= t.min_quantity;
            const imgUrl = toolImagePublicUrl(t.image_path);
            return (
              <TableRow
                key={t.id}
                className={
                  sel.has(t.id) ? "bg-primary/5" : "hover:bg-muted/40"
                }
              >
                <TableCell>
                  <Checkbox
                    checked={sel.has(t.id)}
                    onCheckedChange={() => sel.toggle(t.id)}
                    onClick={(e) => {
                      if ((e as React.MouseEvent).shiftKey) {
                        e.preventDefault();
                        sel.toggleRange(t.id);
                      }
                    }}
                  />
                </TableCell>
                <TableCell>
                  <div className="size-10 rounded-md border bg-muted/40 overflow-hidden flex items-center justify-center shrink-0">
                    {imgUrl ? (
                      <Image
                        src={imgUrl}
                        alt={t.name}
                        width={40}
                        height={40}
                        className="size-full object-cover"
                      />
                    ) : (
                      <Wrench className="size-4 text-muted-foreground/50" />
                    )}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs">{t.code || "—"}</TableCell>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {[t.type, t.size, t.material].filter(Boolean).join(" · ") || "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {t.location || "—"}
                </TableCell>
                <TableCell className="text-right font-mono">
                  <span
                    className={
                      low
                        ? "text-amber-600 font-semibold flex items-center justify-end gap-1"
                        : ""
                    }
                  >
                    {low && <AlertTriangle className="size-3.5" />}
                    {t.quantity} / {t.min_quantity}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      t.condition === "degistirilmeli"
                        ? "destructive"
                        : "outline"
                    }
                  >
                    {TOOL_CONDITION_LABEL[t.condition]}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-1 justify-end">
                    <ToolDialog
                      tool={t}
                      trigger={
                        <Button variant="ghost" size="sm">
                          Düzenle
                        </Button>
                      }
                    />
                    <DeleteButton
                      action={async () => {
                        "use server";
                        return deleteTool(t.id);
                      }}
                      confirmText={`'${t.name}' silinsin mi?`}
                    />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </>
  );
}
