"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./sidebar";
import { AuthProvider } from "./auth-context";
import NotificationBell from "./notification-bell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === "/" || pathname === "/login";

  return (
    <AuthProvider>
      {isAuthPage ? (
        <main className="min-h-screen flex items-center justify-center p-4">
          {children}
        </main>
      ) : (
        <div className="min-h-screen flex">
          <Sidebar />
          <NotificationBell />
          <main className="flex-1 p-6 md:p-8 overflow-y-auto min-h-screen">
            {children}
          </main>
        </div>
      )}
    </AuthProvider>
  );
}
