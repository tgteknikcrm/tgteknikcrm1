"use client";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Search,
  Factory,
  LogOut,
  Settings,
  ShieldCheck,
  User,
} from "lucide-react";
import Link from "next/link";
import { signOut } from "@/app/(auth)/login/actions";
import { formatPhoneForDisplay } from "@/lib/phone";
import { NotificationBell } from "./notification-bell";
import { MessagesButton } from "./messages-button";
import { MessageNotifier } from "./message-notifier";

interface TopbarProps {
  isAdmin: boolean;
  profile: {
    full_name: string | null;
    phone: string | null;
    role: "admin" | "operator";
  };
}

export function Topbar({ isAdmin, profile }: TopbarProps) {
  const phoneDisplay = formatPhoneForDisplay(profile.phone);
  const display = profile.full_name || phoneDisplay || "Kullanıcı";
  const initials = display
    ? display
        .split(" ")
        .map((s) => s[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?";

  function openSearch() {
    window.dispatchEvent(new Event("tg-open-search"));
  }

  return (
    <header
      className={[
        "sticky top-0 z-30 h-14",
        "bg-background/85 backdrop-blur-md border-b",
        "flex items-center gap-2 px-3 md:px-4",
      ].join(" ")}
    >
      {/* Mobile-only logo (desktop already has it in the sidebar) */}
      <div className="md:hidden flex items-center gap-2 mr-1">
        <div className="size-8 rounded-md bg-primary/15 flex items-center justify-center">
          <Factory className="size-4 text-primary" />
        </div>
      </div>

      {/* Search button — opens the existing command palette */}
      <button
        type="button"
        onClick={openSearch}
        className={[
          "flex-1 max-w-md flex items-center gap-2 h-9 px-3 rounded-md border",
          "bg-muted/40 hover:bg-muted text-muted-foreground",
          "transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        ].join(" ")}
        aria-label="Ara"
      >
        <Search className="size-4 shrink-0" />
        <span className="text-sm flex-1 text-left truncate">
          Ara — makine, iş, takım, sipariş…
        </span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border bg-background px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1">
        {/* Messages — links to /messages with realtime unread badge */}
        <MessagesButton />

        {/* Browser notification toggle (sound + desktop notif when tab hidden) */}
        <MessageNotifier />

        {/* Notifications */}
        <NotificationBell variant="icon" />

        {/* Profile dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-9 px-2 gap-2 rounded-full hover:bg-muted"
              aria-label="Profil menüsü"
            >
              <Avatar className="size-7">
                <AvatarFallback className="text-[11px] font-semibold bg-primary/15 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden lg:inline text-sm font-medium max-w-[10rem] truncate">
                {display}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="flex items-center gap-2.5 py-2">
              <Avatar className="size-9 shrink-0">
                <AvatarFallback className="text-xs font-semibold bg-primary/15 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate leading-tight">
                  {display}
                </div>
                <div className="text-[11px] text-muted-foreground truncate font-mono">
                  {phoneDisplay}
                </div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5 flex items-center gap-1">
                  {profile.role === "admin" ? (
                    <>
                      <ShieldCheck className="size-3" /> Yönetici
                    </>
                  ) : (
                    <>
                      <User className="size-3" /> Operatör
                    </>
                  )}
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {isAdmin && (
              <DropdownMenuItem asChild>
                <Link href="/settings" className="cursor-pointer">
                  <Settings className="size-4" /> Ayarlar
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <form action={signOut}>
              <button
                type="submit"
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-accent text-red-600 dark:text-red-400"
              >
                <LogOut className="size-4" /> Çıkış Yap
              </button>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
