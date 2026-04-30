"use client";

import { useMemo } from "react";
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
import { OperatorDialog } from "./operator-dialog";
import { DeleteButton } from "./delete-button";
import { bulkDeleteOperators, deleteOperator } from "./actions";
import { SHIFT_LABEL, type Operator } from "@/lib/supabase/types";
import { useBulkSelection } from "@/lib/use-bulk-selection";
import { BulkActionsBar } from "@/components/app/bulk-actions-bar";

/**
 * Client wrapper around the operators table — adds a checkbox column
 * + sticky bulk-action bar. Server fetched the rows; we just attach
 * selection state on top.
 */
export function OperatorsTable({ operators }: { operators: Operator[] }) {
  const router = useRouter();
  const ids = useMemo(() => operators.map((o) => o.id), [operators]);
  const sel = useBulkSelection(ids);

  return (
    <>
      <BulkActionsBar
        count={sel.size}
        total={ids.length}
        onSelectAll={sel.selectAll}
        onClear={sel.clear}
        ids={sel.ids}
        itemLabel="operatör"
        onDelete={async (toDelete) => {
          const r = await bulkDeleteOperators(toDelete);
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
            <TableHead>Ad Soyad</TableHead>
            <TableHead>Sicil</TableHead>
            <TableHead>Telefon</TableHead>
            <TableHead>Vardiya</TableHead>
            <TableHead>Durum</TableHead>
            <TableHead className="text-right">İşlem</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {operators.map((o) => (
            <TableRow
              key={o.id}
              data-state={sel.has(o.id) ? "selected" : undefined}
              className={sel.has(o.id) ? "bg-primary/5" : undefined}
            >
              <TableCell>
                <Checkbox
                  checked={sel.has(o.id)}
                  onCheckedChange={() => sel.toggle(o.id)}
                  onClick={(e) => {
                    if ((e as React.MouseEvent).shiftKey) {
                      e.preventDefault();
                      sel.toggleRange(o.id);
                    }
                  }}
                  aria-label="Satır seç"
                />
              </TableCell>
              <TableCell className="font-medium">{o.full_name}</TableCell>
              <TableCell className="text-muted-foreground">
                {o.employee_no || "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {o.phone || "—"}
              </TableCell>
              <TableCell>{o.shift ? SHIFT_LABEL[o.shift] : "—"}</TableCell>
              <TableCell>
                <Badge variant={o.active ? "default" : "secondary"}>
                  {o.active ? "Aktif" : "Pasif"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex gap-1 justify-end">
                  <OperatorDialog
                    operator={o}
                    trigger={
                      <Button variant="ghost" size="sm">
                        Düzenle
                      </Button>
                    }
                  />
                  <DeleteButton
                    action={async () => {
                      "use server";
                      return deleteOperator(o.id);
                    }}
                    confirmText={`'${o.full_name}' silinsin mi?`}
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
