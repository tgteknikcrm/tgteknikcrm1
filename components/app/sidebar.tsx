"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Factory, LogOut } from "lucide-react";
import { navItems } from "./nav-config";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { formatPhoneForDisplay } from "@/lib/phone";
import { signOut } from "@/app/(auth)/login/actions";

interface SidebarProps {
  isAdmin: boolean;
  onNavigate?: () => void;
  profile?: {
    full_name: string | null;
    phone: string | null;
    role: "admin" | "operator";
  };
}

export function Sidebar({ isAdmin, onNavigate, profile }: SidebarProps) {
  const pathname = usePathname();
  const items = navItems.filter((i) => !i.adminOnly || isAdmin);

  const phoneDisplay = formatPhoneForDisplay(profile?.phone ?? null);
  const display = profile?.full_name || phoneDisplay;
  const initials = display
    ? display
        .split(" ")
        .map((s) => s[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?";

  return (
    <aside className="flex h-full flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
        <div className="size-9 rounded-lg bg-primary/15 flex items-center justify-center">
          <Factory className="size-5 text-primary" />
        </div>
        <div>
          <div className="font-semibold tracking-tight leading-none">TG Teknik</div>
          <div className="text-xs text-sidebar-foreground/60 mt-0.5">Üretim Takip</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {profile && (
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2.5 rounded-md px-2 py-2">
            <Avatar className="size-9 shrink-0">
              <AvatarFallback className="text-xs font-semibold bg-sidebar-primary/15 text-sidebar-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold truncate leading-tight">
                {display}
              </div>
              <div className="text-[11px] text-sidebar-foreground/60 truncate font-mono">
                {phoneDisplay}
              </div>
              <div className="text-[10px] text-sidebar-foreground/60 uppercase tracking-wider mt-0.5">
                {profile.role === "admin" ? "Yönetici" : "Operatör"}
              </div>
            </div>
            <form action={signOut}>
              <Button
                type="submit"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0 text-sidebar-foreground/70 hover:text-sidebar-foreground"
                title="Çıkış"
              >
                <LogOut className="size-4" />
              </Button>
            </form>
          </div>
        </div>
      )}
    </aside>
  );
}
