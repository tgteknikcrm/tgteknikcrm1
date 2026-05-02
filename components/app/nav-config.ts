import {
  LayoutDashboard,
  Factory,
  Users,
  ShoppingCart,
  ClipboardCheck,
  Settings,
  AlertTriangle,
  MessageSquare,
  BarChart3,
  CalendarRange,
  Cog,
  type LucideIcon,
} from "lucide-react";

/**
 * Nav structure mirrors the reference Plan UI:
 *   - Top-level entries are either a single Leaf (clickable link) or a
 *     Group (header + chevron + nested children).
 *   - Active sub-items are rendered with a "└" connector + bold text.
 *   - Bottom section is separated by a thin rule and currently holds
 *     Settings (admin-only).
 */
export interface NavLeaf {
  kind?: "leaf";
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

export interface NavGroupChild {
  href: string;
  label: string;
}

export interface NavGroup {
  kind: "group";
  label: string;
  icon: LucideIcon;
  children: NavGroupChild[];
  adminOnly?: boolean;
}

export type NavEntry = NavLeaf | NavGroup;

export const navItems: NavEntry[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/messages", label: "Mesajlar", icon: MessageSquare },
  {
    kind: "group",
    label: "Görevler & Takvim",
    icon: CalendarRange,
    children: [
      { href: "/tasks", label: "Görevler" },
      { href: "/calendar", label: "Takvim" },
      { href: "/timeline", label: "Zaman Çizelgesi" },
    ],
  },
  {
    kind: "group",
    label: "Üretim",
    icon: Cog,
    children: [
      { href: "/jobs", label: "İşler" },
      { href: "/production", label: "Üretim Formları" },
      { href: "/products", label: "Ürünler" },
    ],
  },
  {
    kind: "group",
    label: "Tedarik",
    icon: ShoppingCart,
    children: [
      { href: "/orders", label: "Siparişler" },
      { href: "/suppliers", label: "Tedarikçiler" },
      { href: "/tools", label: "Takım Listesi" },
    ],
  },
  { href: "/machines", label: "Makineler", icon: Factory },
  { href: "/breakdowns", label: "Arıza & Bakım", icon: AlertTriangle },
  { href: "/operators", label: "Operatörler", icon: Users },
  {
    kind: "group",
    label: "Kalite & Tasarım",
    icon: ClipboardCheck,
    children: [
      { href: "/quality", label: "Kalite Kontrol" },
      { href: "/cad-cam", label: "CAD/CAM" },
      { href: "/drawings", label: "Teknik Resimler" },
    ],
  },
  { href: "/reports", label: "Raporlar", icon: BarChart3 },
];

/** Bottom section — separated by a rule from the main nav. */
export const bottomNavItems: NavLeaf[] = [
  { href: "/settings", label: "Ayarlar", icon: Settings, adminOnly: true },
];

export function isNavGroup(e: NavEntry): e is NavGroup {
  return (e as NavGroup).kind === "group";
}
