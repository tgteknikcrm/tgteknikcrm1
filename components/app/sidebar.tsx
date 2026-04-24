"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Factory } from "lucide-react";
import { navItems } from "./nav-config";

interface SidebarProps {
  isAdmin: boolean;
  onNavigate?: () => void;
}

export function Sidebar({ isAdmin, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const items = navItems.filter((i) => !i.adminOnly || isAdmin);

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

      <div className="border-t border-sidebar-border p-4 text-xs text-sidebar-foreground/50">
        v0.1.0 · TG Teknik
      </div>
    </aside>
  );
}
