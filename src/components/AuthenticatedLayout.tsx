"use client";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";
import MobileSearch from "./MobileSearch";
import { ClientLayout } from "./ClientLayout";
import { CommandPalette } from "./CommandPalette";

export function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const pathname = usePathname();

  if (pathname === "/login") {
    return <>{children}</>;
  }

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500 text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <CommandPalette />
      {/* Desktop sidebar - hidden on mobile */}
      <div className="hidden md:block">
        <Sidebar />
      </div>
      <ClientLayout>
        <main className="flex-1 md:ml-64 p-4 md:p-8 overflow-auto min-h-screen pb-24 md:pb-8">
          <div className="md:hidden mb-4">
            <MobileSearch />
          </div>
          {children}
        </main>
      </ClientLayout>
      {/* Mobile bottom nav - visible only on mobile */}
      <div className="md:hidden">
        <MobileNav />
      </div>
    </>
  );
}
