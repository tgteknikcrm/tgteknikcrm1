"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Menu, LogOut, User as UserIcon } from "lucide-react";
import { Sidebar } from "./sidebar";
import { signOut } from "@/app/(auth)/login/actions";

interface TopbarProps {
  email: string;
  fullName: string | null;
  role: "admin" | "operator";
}

export function Topbar({ email, fullName, role }: TopbarProps) {
  const [open, setOpen] = useState(false);
  const isAdmin = role === "admin";
  const display = fullName || email;
  const initials = display
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="h-14 flex items-center gap-3 px-4 md:px-6 border-b bg-background/95 backdrop-blur sticky top-0 z-30">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Menü</SheetTitle>
          </SheetHeader>
          <Sidebar isAdmin={isAdmin} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <span className="hidden sm:inline text-sm text-muted-foreground">
          {role === "admin" ? "Yönetici" : "Operatör"}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 px-2 gap-2">
              <Avatar className="size-7">
                <AvatarFallback className="text-xs">{initials || "?"}</AvatarFallback>
              </Avatar>
              <span className="hidden sm:inline text-sm max-w-40 truncate">{display}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="text-sm font-medium truncate">{display}</div>
              <div className="text-xs text-muted-foreground truncate">{email}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <UserIcon className="size-4" /> Profilim
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <form action={signOut}>
              <DropdownMenuItem asChild>
                <button type="submit" className="w-full">
                  <LogOut className="size-4" /> Çıkış Yap
                </button>
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
