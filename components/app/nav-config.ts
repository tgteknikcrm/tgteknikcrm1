import {
  LayoutDashboard,
  Factory,
  Users,
  Wrench,
  ClipboardList,
  FileText,
  Image as ImageIcon,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

export const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/production", label: "Üretim Formları", icon: ClipboardList },
  { href: "/jobs", label: "İşler / Siparişler", icon: FileText },
  { href: "/machines", label: "Makineler", icon: Factory },
  { href: "/operators", label: "Operatörler", icon: Users },
  { href: "/tools", label: "Takım Listesi", icon: Wrench },
  { href: "/drawings", label: "Teknik Resimler", icon: ImageIcon },
  { href: "/reports", label: "Raporlar", icon: BarChart3 },
  { href: "/settings", label: "Ayarlar", icon: Settings, adminOnly: true },
];
