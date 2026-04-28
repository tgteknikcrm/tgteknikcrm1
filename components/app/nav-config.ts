import {
  LayoutDashboard,
  Factory,
  Users,
  Wrench,
  ClipboardList,
  ClipboardCheck,
  FileText,
  Image as ImageIcon,
  BarChart3,
  Settings,
  ShoppingCart,
  Truck,
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
  { href: "/jobs", label: "İşler", icon: FileText },
  { href: "/orders", label: "Siparişler", icon: ShoppingCart },
  { href: "/suppliers", label: "Tedarikçiler", icon: Truck },
  { href: "/machines", label: "Makineler", icon: Factory },
  { href: "/operators", label: "Operatörler", icon: Users },
  { href: "/tools", label: "Takım Listesi", icon: Wrench },
  { href: "/drawings", label: "Teknik Resimler", icon: ImageIcon },
  { href: "/quality", label: "Kalite Kontrol", icon: ClipboardCheck },
  { href: "/reports", label: "Raporlar", icon: BarChart3 },
  { href: "/settings", label: "Ayarlar", icon: Settings, adminOnly: true },
];
