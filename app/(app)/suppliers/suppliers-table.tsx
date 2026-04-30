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
import type { Supplier } from "@/lib/supabase/types";
import { SupplierDialog } from "./supplier-dialog";
import { DeleteButton } from "../operators/delete-button";
import { bulkDeleteSuppliers, deleteSupplier } from "./actions";
import { useBulkSelection } from "@/lib/use-bulk-selection";
import { BulkActionsBar } from "@/components/app/bulk-actions-bar";

export function SuppliersTable({ suppliers }: { suppliers: Supplier[] }) {
  const router = useRouter();
  const ids = useMemo(() => suppliers.map((s) => s.id), [suppliers]);
  const sel = useBulkSelection(ids);

  return (
    <>
      <BulkActionsBar
        count={sel.size}
        total={ids.length}
        onSelectAll={sel.selectAll}
        onClear={sel.clear}
        ids={sel.ids}
        itemLabel="tedarikçi"
        onDelete={async (toDelete) => {
          const r = await bulkDeleteSuppliers(toDelete);
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
                  sel.allSelected
                    ? true
                    : sel.someSelected
                      ? "indeterminate"
                      : false
                }
                onCheckedChange={(v) => (v ? sel.selectAll() : sel.clear())}
                aria-label="Tümünü seç"
              />
            </TableHead>
            <TableHead>Tedarikçi</TableHead>
            <TableHead>Yetkili</TableHead>
            <TableHead>Telefon</TableHead>
            <TableHead>E-posta</TableHead>
            <TableHead>Durum</TableHead>
            <TableHead className="text-right">İşlem</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {suppliers.map((s) => (
            <TableRow
              key={s.id}
              className={sel.has(s.id) ? "bg-primary/5" : undefined}
            >
              <TableCell>
                <Checkbox
                  checked={sel.has(s.id)}
                  onCheckedChange={() => sel.toggle(s.id)}
                  onClick={(e) => {
                    if ((e as React.MouseEvent).shiftKey) {
                      e.preventDefault();
                      sel.toggleRange(s.id);
                    }
                  }}
                />
              </TableCell>
              <TableCell className="font-medium">{s.name}</TableCell>
              <TableCell className="text-muted-foreground">
                {s.contact_person || "—"}
              </TableCell>
              <TableCell className="text-muted-foreground font-mono text-sm">
                {s.phone || "—"}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {s.email || "—"}
              </TableCell>
              <TableCell>
                <Badge variant={s.active ? "default" : "secondary"}>
                  {s.active ? "Aktif" : "Pasif"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex gap-1 justify-end">
                  <SupplierDialog
                    supplier={s}
                    trigger={
                      <Button variant="ghost" size="sm">
                        Düzenle
                      </Button>
                    }
                  />
                  <DeleteButton
                    action={() => deleteSupplier(s.id)}
                    confirmText={`'${s.name}' tedarikçisi silinsin mi?`}
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
