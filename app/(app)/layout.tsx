import { redirect } from "next/navigation";
import { getProfile } from "@/lib/supabase/server";
import { Sidebar } from "@/components/app/sidebar";
import { MobileNav } from "@/components/app/mobile-nav";
import { Topbar } from "@/components/app/topbar";
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
  const profileLite = {
    full_name: profile.full_name,
    phone: profile.phone,
    role: profile.role,
  };

  return (
    <div className="min-h-screen flex">
      {/* ── Sidebar (desktop): sticky full-height column. The aside inside
            uses flex-col + mt-auto on the profile block so the avatar
            stays pinned to the bottom regardless of nav length. ── */}
      <aside className="hidden md:flex md:w-64 lg:w-72 shrink-0 sticky top-0 h-screen z-20">
        <Sidebar isAdmin={isAdmin} profile={profileLite} />
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile bar: keeps the hamburger + sheet sidebar (also has the
            profile block inside). Only renders below md. */}
        <MobileNav isAdmin={isAdmin} profile={profileLite} />

        {/* Topbar: search · messages · notifications · profile (md+).
            Hidden below md because MobileNav already takes that space. */}
        <div className="hidden md:block">
          <Topbar isAdmin={isAdmin} profile={profileLite} />
        </div>

        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-x-hidden">
          {children}
        </main>
      </div>

      <SearchFab />
      <PwaInstallPrompt />
    </div>
  );
}
