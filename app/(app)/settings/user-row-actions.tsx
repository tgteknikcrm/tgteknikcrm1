"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { toggleUserActive, deleteUser } from "./actions";

export function ActiveToggle({
  userId,
  active,
  disabled,
}: {
  userId: string;
  active: boolean;
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const r = await toggleUserActive(userId, !active);
      if (r.error) toast.error(r.error);
      else toast.success(active ? "Pasife alındı" : "Aktifleştirildi");
    });
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={disabled || pending}
      className="h-auto p-0 hover:bg-transparent"
      title={active ? "Pasife al" : "Aktifleştir"}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Badge variant={active ? "default" : "secondary"} className="cursor-pointer">
          {active ? "Aktif" : "Pasif"}
        </Badge>
      )}
    </Button>
  );
}

export function DeleteUserButton({ userId, disabled }: { userId: string; disabled?: boolean }) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!confirm("Bu kullanıcıyı silmek istediğine emin misin? Geri alınamaz.")) return;
    startTransition(async () => {
      const r = await deleteUser(userId);
      if (r.error) toast.error(r.error);
      else toast.success("Kullanıcı silindi");
    });
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      disabled={disabled || pending}
      title="Sil"
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
    </Button>
  );
}
