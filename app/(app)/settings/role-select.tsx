"use client";

import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { updateUserRole } from "./actions";
import type { UserRole } from "@/lib/supabase/types";

export function RoleSelect({
  userId,
  role,
  disabled,
}: {
  userId: string;
  role: UserRole;
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function onChange(v: string) {
    startTransition(async () => {
      const r = await updateUserRole(userId, v as UserRole);
      if (r.error) toast.error(r.error);
      else toast.success("Rol güncellendi");
    });
  }

  return (
    <Select value={role} onValueChange={onChange} disabled={disabled || pending}>
      <SelectTrigger className="w-36 h-8">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="admin">Yönetici</SelectItem>
        <SelectItem value="operator">Operatör</SelectItem>
      </SelectContent>
    </Select>
  );
}
