"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronUp,
  Factory,
  LogOut,
} from "lucide-react";
import {
  bottomNavItems,
  isNavGroup,
  navItems,
  type NavEntry,
  type NavGroup,
  type NavLeaf,
} from "./nav-config";
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

function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

function groupHasActiveChild(group: NavGroup, pathname: string): boolean {
  return group.children.some((c) => isActivePath(pathname, c.href));
}

export function Sidebar({ isAdmin, onNavigate, profile }: SidebarProps) {
  const pathname = usePathname();

  // Filter admin-only entries
  const items = useMemo(
    () => navItems.filter((i) => !i.adminOnly || isAdmin),
    [isAdmin],
  );
  const bottomItems = useMemo(
    () => bottomNavItems.filter((i) => !i.adminOnly || isAdmin),
    [isAdmin],
  );

  // Open groups state. Initial: any group containing the active path
  // is open. As the user navigates into a closed group, that group
  // auto-expands (effect below). User can still toggle manually.
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const set = new Set<string>();
    for (const i of items) {
      if (isNavGroup(i) && groupHasActiveChild(i, pathname)) {
        set.add(i.label);
      }
    }
    return set;
  });

  useEffect(() => {
    setOpenGroups((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const i of items) {
        if (
          isNavGroup(i) &&
          groupHasActiveChild(i, pathname) &&
          !next.has(i.label)
        ) {
          next.add(i.label);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [pathname, items]);

  function toggleGroup(label: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

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
      {/* Logo */}
      <div className="px-5 pt-5 pb-3 flex items-center gap-2.5">
        <div className="size-7 rounded-md bg-foreground/90 flex items-center justify-center shrink-0">
          <Factory className="size-4 text-background" />
        </div>
        <span className="text-xl font-bold tracking-tight">TG Teknik</span>
      </div>

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {items.map((entry) =>
          isNavGroup(entry) ? (
            <GroupItem
              key={entry.label}
              group={entry}
              pathname={pathname}
              open={openGroups.has(entry.label)}
              onToggle={() => toggleGroup(entry.label)}
              onNavigate={onNavigate}
            />
          ) : (
            <LeafItem
              key={entry.href}
              leaf={entry}
              pathname={pathname}
              onNavigate={onNavigate}
            />
          ),
        )}
      </nav>

      {/* Bottom: separator + Ayarlar + profile/signout */}
      <div className="mt-auto border-t border-sidebar-border">
        {bottomItems.length > 0 && (
          <div className="px-3 pt-3 pb-1 space-y-0.5">
            {bottomItems.map((leaf) => (
              <LeafItem
                key={leaf.href}
                leaf={leaf}
                pathname={pathname}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        )}

        {profile && (
          <div className="p-3">
            <div className="flex items-center gap-2.5 rounded-md px-2 py-2">
              <Avatar className="size-8 shrink-0">
                <AvatarFallback className="text-[11px] font-semibold bg-muted text-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold truncate leading-tight">
                  {display}
                </div>
                <div className="text-[10px] text-sidebar-foreground/60 truncate">
                  {profile.role === "admin" ? "Yönetici" : "Operatör"}
                </div>
              </div>
              <form action={signOut}>
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 text-sidebar-foreground/60 hover:text-sidebar-foreground"
                  title="Çıkış"
                >
                  <LogOut className="size-3.5" />
                </Button>
              </form>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

/* ── Top-level leaf (icon + label, single link) ───────────────────── */

function LeafItem({
  leaf,
  pathname,
  onNavigate,
}: {
  leaf: NavLeaf;
  pathname: string;
  onNavigate?: () => void;
}) {
  const Icon = leaf.icon;
  const active = isActivePath(pathname, leaf.href);
  return (
    <Link
      href={leaf.href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
        active
          ? "bg-muted font-bold text-foreground"
          : "text-sidebar-foreground/80 font-medium hover:bg-muted/60 hover:text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="truncate">{leaf.label}</span>
    </Link>
  );
}

/* ── Group (chevron-expand header + indented children with └ line) ── */

function GroupItem({
  group,
  pathname,
  open,
  onToggle,
  onNavigate,
}: {
  group: NavGroup;
  pathname: string;
  open: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}) {
  const Icon = group.icon;
  const hasActive = groupHasActiveChild(group, pathname);
  const Chevron = open ? ChevronUp : ChevronDown;
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex items-center gap-3 w-full rounded-md px-3 py-2 text-sm transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          hasActive
            ? "text-foreground font-bold"
            : "text-sidebar-foreground/80 font-medium hover:bg-muted/60 hover:text-foreground",
        )}
      >
        <Icon className="size-4 shrink-0" />
        <span className="flex-1 text-left truncate">{group.label}</span>
        <Chevron className="size-4 shrink-0 text-sidebar-foreground/60" />
      </button>
      {open && (
        <ul className="mt-0.5 space-y-0.5">
          {group.children.map((child) => (
            <SubItem
              key={child.href}
              href={child.href}
              label={child.label}
              pathname={pathname}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/* ── Sub-item (indented row with "└" connector) ──────────────────── */

function SubItem({
  href,
  label,
  pathname,
  onNavigate,
}: {
  href: string;
  label: string;
  pathname: string;
  onNavigate?: () => void;
}) {
  const active = isActivePath(pathname, href);
  return (
    <li>
      <Link
        href={href}
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-2 rounded-md pl-7 pr-3 py-1.5 text-sm transition-colors",
          active
            ? "bg-muted font-bold text-foreground"
            : "text-sidebar-foreground/70 font-medium hover:bg-muted/50 hover:text-foreground",
        )}
      >
        <span
          className={cn(
            "font-mono text-xs leading-none select-none",
            active
              ? "text-sidebar-foreground/60"
              : "text-sidebar-foreground/35",
          )}
          aria-hidden
        >
          └
        </span>
        <span className="truncate">{label}</span>
      </Link>
    </li>
  );
}
