import { redirect } from "next/navigation";
import { getProfile } from "@/lib/supabase/server";
import { Sidebar } from "@/components/app/sidebar";
import { MobileNav } from "@/components/app/mobile-nav";
import { SearchFab } from "@/components/app/search-fab";
import { PwaInstallPrompt } from "@/components/app/pwa-install-prompt";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  const isAdmin = profile.role === "admin";

  return (
    <div className="min-h-screen flex">
      <div className="hidden md:flex md:w-64 lg:w-72 shrink-0">
        <Sidebar
          isAdmin={isAdmin}
          profile={{
            full_name: profile.full_name,
            phone: profile.phone,
            role: profile.role,
          }}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <MobileNav
          isAdmin={isAdmin}
          profile={{
            full_name: profile.full_name,
            phone: profile.phone,
            role: profile.role,
          }}
        />
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-x-hidden">
          {children}
        </main>
      </div>

      <SearchFab />
      <PwaInstallPrompt />
    </div>
  );
}
