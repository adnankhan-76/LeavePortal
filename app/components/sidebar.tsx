"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CalendarDays, UserPlus, LogOut, Lock, Users } from "./icons";
import { useAuth } from "./auth-context";
import ChangePasswordModal from "./change-password-modal";

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  const isAdmin = user?.role === "admin";

  // Dynamic menu items based on role
  const menuItems = isAdmin
    ? [
        { name: "Home", href: "/home", icon: Home },
        { name: "Leaves & WFH", href: "/leaves", icon: CalendarDays },
        { name: "Users", href: "/users", icon: Users },
      ]
    : [
        { name: "Home", href: "/home", icon: Home },
        { name: "My Leaves", href: "/leaves", icon: CalendarDays },
      ];

  const isActive = (href: string) => {
    if (href === "/home") {
      return pathname === "/home";
    }
    if (href === "/signup") {
      return pathname === "/signup" || pathname === "/add-user";
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <>
      <aside className="w-68 min-h-screen bg-[#DB9617] p-6 shrink-0 flex flex-col justify-between select-none">
        <div>
          <div className="mb-10 px-2">
            <h2 className="text-3xl font-black tracking-tight text-[#0D0D0D]">
              {isAdmin ? "Admin" : "Team"}
            </h2>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-md bg-[#0D0D0D] text-white">
                {isAdmin ? "Admin Portal" : "Team Portal"}
              </span>
            </div>
          </div>

          <nav className="space-y-3">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-200 ${
                    active
                      ? "bg-white text-[#0D0D0D] font-extrabold shadow-lg translate-x-1"
                      : "text-[#0D0D0D] font-bold hover:bg-white/80 hover:translate-x-1"
                  }`}
                >
                  <Icon size={26} className="shrink-0" />
                  <span className="text-lg">{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="pt-6 border-t-2 border-[#0D0D0D]/15 px-2 flex flex-col gap-4">
          {/* User profile snippet */}
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-full bg-[#0D0D0D] text-white flex items-center justify-center font-black text-base shrink-0 shadow-md">
              {user?.name ? user.name.slice(0, 2).toUpperCase() : "US"}
            </div>
            <div className="truncate flex-1">
              <p className="text-base font-extrabold text-[#0D0D0D] leading-tight truncate">
                {user?.name || "User"}
              </p>
              <p className="text-xs text-[#0D0D0D]/80 font-medium truncate mt-0.5">
                {user?.email || "user@sikka.com"}
              </p>
            </div>
          </div>

          {/* Change Password button */}
          <button
            onClick={() => setIsPasswordModalOpen(true)}
            className="flex items-center gap-3 text-sm font-extrabold text-[#0D0D0D] hover:bg-white/60 px-3.5 py-2.5 rounded-xl transition cursor-pointer text-left"
          >
            <Lock size={18} />
            Change Password
          </button>

          {/* Sign out */}
          <button
            onClick={logout}
            className="flex items-center gap-3 text-sm font-extrabold text-[#0D0D0D]/80 hover:text-[#0D0D0D] hover:bg-white/60 px-3.5 py-2.5 rounded-xl transition cursor-pointer text-left"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />
    </>
  );
}
