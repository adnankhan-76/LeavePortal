"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Users,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  UserPlus,
  Database,
  Check,
  X,
  Loader2,
  Search,
  Laptop,
} from "../components/icons";
import { useAuth } from "../components/auth-context";

interface LeaveItem {
  id: string;
  userId: string;
  employee: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: "Pending" | "Approved" | "Rejected";
}

interface UserItem {
  id: string;
  name: string;
  email: string;
  department: string;
  sickLeaves: number;
  casualLeaves: number;
  annualLeaves: number;
  needsDetails?: number;
  createdAt: string;
  balances?: {
    sick: { allowed: number; used: number; remaining: number };
    casual: { allowed: number; used: number; remaining: number };
    annual: { allowed: number; used: number; remaining: number };
    wfh?: { used: number };
  };
}

export default function HomeDashboardPage() {
  const { user, balances } = useAuth();
  const isAdmin = user?.role === "admin";
  const router = useRouter();
  const [leaves, setLeaves] = useState<LeaveItem[]>([]);
  const [usersList, setUsersList] = useState<UserItem[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    // Fetch leaves
    fetch("/api/leaves")
      .then((res) => res.json())
      .then((data) => {
        if (!ignore && data.success) {
          setLeaves(data.leaves.slice(0, 6));
          if (data.stats) setStats(data.stats);
        }
      })
      .catch((err) => console.error("Failed to load dashboard data from SQLite:", err))
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    // If admin, also fetch all users with live balances
    if (isAdmin) {
      fetch("/api/users")
        .then((res) => res.json())
        .then((data) => {
          if (!ignore && data.success) {
            setUsersList(data.users);
          }
        })
        .catch((err) => console.error("Failed to load users:", err))
        .finally(() => {
          if (!ignore) setLoadingUsers(false);
        });
    }

    return () => {
      ignore = true;
    };
  }, [isAdmin]);

  // Reload dashboard data when a notification arrives
  useEffect(() => {
    const reload = () => {
      fetch("/api/leaves", { cache: "no-store" })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setLeaves(data.leaves.slice(0, 6));
            if (data.stats) setStats(data.stats);
          }
        })
        .catch(() => {});
      if (isAdmin) {
        fetch("/api/users", { cache: "no-store" })
          .then((res) => res.json())
          .then((data) => data.success && setUsersList(data.users))
          .catch(() => {});
      }
    };
    window.addEventListener("sika:notification", reload);
    return () => window.removeEventListener("sika:notification", reload);
  }, [isAdmin]);

  const handleStatusUpdate = async (id: string, newStatus: "Approved" | "Rejected") => {
    try {
      setActionId(id);
      const res = await fetch("/api/leaves", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setLeaves((prev) =>
          prev.map((l) => (l.id === id ? { ...l, status: newStatus } : l))
        );
        if (data.stats) setStats(data.stats);
      } else {
        if (res.status === 409 && data.leave) {
          setLeaves((prev) => prev.map((l) => (l.id === id ? { ...l, status: data.leave.status } : l)));
        }
        alert(data.error || "Failed to update status");
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    } finally {
      setActionId(null);
    }
  };

  const renderTypeBadge = (type: string) => {
    const lower = type.toLowerCase();
    if (lower.includes("work from home") || lower.includes("wfh")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
          <Laptop size={13} />
          WFH
        </span>
      );
    }
    if (lower.includes("sick")) {
      return (
        <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
          Sick Leave
        </span>
      );
    }
    if (lower.includes("casual")) {
      return (
        <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30">
          Casual Leave
        </span>
      );
    }
    return (
      <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
        {type}
      </span>
    );
  };

  const filteredUsers = usersList.filter((u) => {
    const term = userSearch.toLowerCase();
    return (
      u.name.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      u.department.toLowerCase().includes(term)
    );
  });

  const adminStats = [
    { label: "Total Users", value: usersList.length.toString(), change: "Registered employees", icon: Users, color: "text-white" },
    { label: "Pending Applications", value: stats.pending.toString(), change: "Needs review", icon: Clock, color: "text-amber-400" },
    { label: "Approved Requests", value: stats.approved.toString(), change: "Accepted by admin", icon: CheckCircle2, color: "text-emerald-400" },
    { label: "Rejected Requests", value: stats.rejected.toString(), change: "Declined by admin", icon: CalendarDays, color: "text-rose-400" },
  ];

  return (
    <div className="space-y-10 max-w-7xl">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
        <div>
          <div className="flex items-center gap-3.5">
            <h1 className="text-4xl font-black text-white tracking-tight">
              Welcome back, {user?.name || "User"} 👋
            </h1>
          
          </div>
          {/* <p className="text-neutral-300 text-base mt-2">
            {isAdmin
              ? "System administrator overview. Manage registered employees, leave balances, and review applications."
              : `Logged in as ${user?.email} (${user?.department || "General"}). View your remaining leave & WFH balances below.`}
          </p> */}
        </div>

        <div className="flex gap-3.5 px-10 py-3">
       
          {isAdmin && (
            <Link
              href="/signup"
              className="text-1xl font-black text-[#0D0D0D] bg-[#DB9617] tracking-tight flex items-center gap-3 px-4 py-3 rounded-2xl">
              <UserPlus size={20} />
              Add New User
            </Link>
          )}
        </div>
      </div>

      {/* New Google user: waiting for admin to fill details */}
      {!isAdmin && user?.needsDetails ? (
        <div className="rounded-2xl border border-[#DB9617]/40 bg-[#DB9617]/10 px-5 py-4">
          <p className="font-extrabold text-[#DB9617]">Your account is waiting for admin details</p>
          <p className="text-sm text-neutral-300 mt-1">
            You signed in with {user.email}. The admin will add your name, department and leave balances shortly.
          </p>
        </div>
      ) : null}

      {/* Admin Stats Grid */}
      {isAdmin && (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
    {adminStats.map((stat) => {
      const Icon = stat.icon;

      return (
        <div
          key={stat.label}
          onClick={() => router.push("/leaves")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              router.push("/leaves");
            }
          }}
          className="bg-[#171717] border border-neutral-800 rounded-3xl p-6 hover:border-[#DB9617] hover:bg-[#202020] transition shadow-md cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-neutral-400 text-base font-bold">
              {stat.label}
            </span>

            <div className="p-3 rounded-2xl bg-[#DB9617]/10 text-[#DB9617]">
              <Icon size={24} />
            </div>
          </div>

          <div className="mt-4 flex items-baseline gap-2.5">
            <span className={`text-4xl font-black ${stat.color}`}>
              {stat.value}
            </span>

            <span className="text-sm text-neutral-400 font-medium">
              {stat.change}
            </span>
          </div>
        </div>
      );
    })}
  </div>
)}
      {/* ADMIN ONLY: All Users Section with Live Search Bar */}
      {isAdmin && (
        <div className="bg-[#171717] border border-neutral-800 rounded-3xl p-7 shadow-xl space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div>
              <h2 className="text-2xl font-black text-white flex items-center gap-3">
                <Users size={26} className="text-[#DB9617]" />
                All Registered Users ({usersList.length})
              </h2>
              <p className="text-sm text-neutral-400 mt-1">
                Search and review employee leave allowances, remaining balances, and departments.
              </p>
            </div>

            {/* User Search Bar */}
            <div className="relative w-full md:w-96">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={19} />
              <input
                type="text"
                placeholder="Search by name, email, department..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-neutral-900 border border-neutral-800 rounded-2xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#DB9617]"
              />
            </div>
          </div>

          {/* Users Table */}
          <div className="overflow-x-auto">
            {loadingUsers ? (
              <div className="py-14 text-center text-neutral-400 flex items-center justify-center gap-3 text-base">
                <Loader2 size={22} className="text-[#DB9617]" />
                Loading users from DataBase...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="py-12 text-center text-neutral-500 text-base">
                {userSearch
                  ? `No users match "${userSearch}".`
                  : "No users registered yet. Click 'Add New User' to add your first employee."}
              </div>
            ) : (
              <table className="w-full text-left text-sm text-neutral-300">
                <thead className="border-b border-neutral-800 uppercase tracking-wider text-neutral-400 text-xs font-bold">
                  <tr>
                    <th className="py-4 px-5">User</th>
                    <th className="py-4 px-5">Department</th>
                    <th className="py-4 px-5 text-center">Sick Leaves</th>
                    <th className="py-4 px-5 text-center">Casual Leaves</th>
                    <th className="py-4 px-5 text-center">Annual Leaves</th>
                    <th className="py-4 px-5 text-center">WFH Taken</th>
                    <th className="py-4 px-5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60">
                  {filteredUsers.map((u) => {
                    const sickRem = u.balances?.sick.remaining ?? u.sickLeaves;
                    const casualRem = u.balances?.casual.remaining ?? u.casualLeaves;
                    const annualRem = u.balances?.annual.remaining ?? u.annualLeaves;
                    const wfhDays = u.balances?.wfh?.used ?? 0;

                    return (
                      <tr key={u.id} className="hover:bg-neutral-800/30 transition">
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-neutral-800 text-white font-black text-sm flex items-center justify-center shrink-0 border border-neutral-700">
                              {u.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-extrabold text-white text-base leading-tight">
                                {u.name}
                                {u.needsDetails ? (
                                  <span className="ml-2 px-2 py-0.5 rounded-md bg-[#DB9617]/20 text-[#DB9617] text-[10px] font-black uppercase align-middle">
                                    Details pending
                                  </span>
                                ) : null}
                              </p>
                              <p className="text-neutral-400 font-mono text-xs mt-0.5">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-5">
                          <span className="px-3 py-1 rounded-lg bg-neutral-800 text-neutral-200 text-xs font-bold">
                            {u.department}
                          </span>
                        </td>
                        <td className="py-4 px-5 text-center">
                          <Link
                            href={`/leaves?type=sick&user=${encodeURIComponent(u.id)}`}
                            className="inline-block px-3 py-1.5 rounded-xl hover:bg-neutral-800 transition cursor-pointer"
                          >
                            <span className="font-black text-amber-400 text-base">{sickRem}</span>
                            <span className="text-neutral-500 text-xs font-medium"> / {u.sickLeaves} left</span>
                          </Link>
                        </td>
                        <td className="py-4 px-5 text-center">
                          <Link
                            href={`/leaves?type=casual&user=${encodeURIComponent(u.id)}`}
                            className="inline-block px-3 py-1.5 rounded-xl hover:bg-neutral-800 transition cursor-pointer"
                          >
                            <span className="font-black text-sky-400 text-base">{casualRem}</span>
                            <span className="text-neutral-500 text-xs font-medium"> / {u.casualLeaves} left</span>
                          </Link>
                        </td>
                        <td className="py-4 px-5 text-center">
                          <Link
                            href={`/leaves?type=annual&user=${encodeURIComponent(u.id)}`}
                            className="inline-block px-3 py-1.5 rounded-xl hover:bg-neutral-800 transition cursor-pointer"
                          >
                            <span className="font-black text-emerald-400 text-base">{annualRem}</span>
                            <span className="text-neutral-500 text-xs font-medium"> / {u.annualLeaves} left</span>
                          </Link>
                        </td>
                        <td className="py-4 px-5 text-center">
                          <Link
                            href={`/leaves?type=wfh&user=${encodeURIComponent(u.id)}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-neutral-800 transition cursor-pointer font-bold text-indigo-400 text-sm"
                          >
                            <Laptop size={14} />
                            {wfhDays}d
                          </Link>
                        </td>
                        <td className="py-4 px-5 text-right">
                          <Link
                            href={`/leaves?user=${encodeURIComponent(u.id)}`}
                            className="text-sm font-bold text-[#DB9617] hover:underline"
                          >
                            View Requests
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* USER ONLY: Personal Leave & WFH Balances Cards */}
      {!isAdmin && balances && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
          <Link href="/leaves?type=sick" className="block bg-[#171717] border border-amber-500/30 rounded-3xl p-6 shadow-lg transition hover:-translate-y-0.5 hover:bg-neutral-900 cursor-pointer">
            <span className="text-amber-400 text-sm font-bold uppercase tracking-wider">Sick Leaves</span>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-4xl font-black text-white">{balances.sick.remaining}</span>
              <span className="text-sm text-neutral-400">/ {balances.sick.allowed} days left</span>
            </div>
            <p className="text-xs text-neutral-400 mt-2 font-medium">{balances.sick.used} days approved & used</p>
          </Link>

          <Link href="/leaves?type=casual" className="block bg-[#171717] border border-sky-500/30 rounded-3xl p-6 shadow-lg transition hover:-translate-y-0.5 hover:bg-neutral-900 cursor-pointer">
            <span className="text-sky-400 text-sm font-bold uppercase tracking-wider">Casual Leaves</span>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-4xl font-black text-white">{balances.casual.remaining}</span>
              <span className="text-sm text-neutral-400">/ {balances.casual.allowed} days left</span>
            </div>
            <p className="text-xs text-neutral-400 mt-2 font-medium">{balances.casual.used} days approved & used</p>
          </Link>

          <Link href="/leaves?type=annual" className="block bg-[#171717] border border-emerald-500/30 rounded-3xl p-6 shadow-lg transition hover:-translate-y-0.5 hover:bg-neutral-900 cursor-pointer">
            <span className="text-emerald-400 text-sm font-bold uppercase tracking-wider">Annual Leaves</span>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-4xl font-black text-white">{balances.annual.remaining}</span>
              <span className="text-sm text-neutral-400">/ {balances.annual.allowed} days left</span>
            </div>
            <p className="text-xs text-neutral-400 mt-2 font-medium">{balances.annual.used} days approved & used</p>
          </Link>

          <Link href="/leaves?type=wfh" className="block bg-[#171717] border border-indigo-500/30 rounded-3xl p-6 shadow-lg transition hover:-translate-y-0.5 hover:bg-neutral-900 cursor-pointer">
            <span className="text-indigo-400 text-sm font-bold uppercase tracking-wider flex items-center gap-2">
              <Laptop size={16} />
              Work From Home
            </span>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-4xl font-black text-white">{balances.wfh?.used ?? 0}</span>
              <span className="text-sm text-neutral-400">days approved</span>
            </div>
            <p className="text-xs text-neutral-400 mt-2 font-medium">Remote work days</p>
          </Link>
        </div>
      )}

      {/* Recent Leaves Section */}
      <div className="bg-[#171717] border border-neutral-800 rounded-3xl p-7 shadow-xl space-y-5">
        <div className="flex items-center justify-between pb-2">
          <div>
            <h2 className="text-2xl font-black text-white flex items-center gap-3">
              <CalendarDays size={24} className="text-[#DB9617]" />
              {isAdmin ? "Recent Leave & WFH Requests " : "My Recent Leaves & WFH"}
            </h2>
            <p className="text-sm text-neutral-400 mt-1">
              {isAdmin
                ? "Review and quickly accept or decline incoming applications"
                : "Status of your leave and Work From Home requests submitted to Admin"}
            </p>
          </div>
          <Link
            href="/leaves"
            className="text-sm font-extrabold text-[#DB9617] hover:underline inline-flex items-center gap-1.5"
          >
            View all ({stats.total})
            <ArrowUpRight size={17} />
          </Link>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-14 text-center text-neutral-400 flex items-center justify-center gap-3 text-base">
              <Loader2 size={22} className="text-[#DB9617]" />
              Loading records...
            </div>
          ) : leaves.length === 0 ? (
            <div className="py-12 text-center text-neutral-500 text-base">
              {isAdmin
                ? "No leave requests in DataBase. When employees apply, they will show up here."
                : "You haven't submitted any requests yet. Click 'Apply / View Leaves' to apply for leave or Work From Home."}
            </div>
          ) : (
            <table className="w-full text-left text-sm text-neutral-300">
              <thead className="border-b border-neutral-800 uppercase tracking-wider text-neutral-400 text-xs font-bold">
                <tr>
                  <th className="py-4 px-5">Employee</th>
                  <th className="py-4 px-5">Type</th>
                  <th className="py-4 px-5">Dates</th>
                  <th className="py-4 px-5">Days</th>
                  <th className="py-4 px-5">Status</th>
                  {isAdmin && <th className="py-4 px-5 text-center">Quick Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {leaves.map((req) => (
                  <tr key={req.id} className="hover:bg-neutral-800/30 transition">
                    <td className="py-4 px-5 font-bold text-white text-base">{req.employee}</td>
                    <td className="py-4 px-5">{renderTypeBadge(req.type)}</td>
                    <td className="py-4 px-5 text-neutral-300 text-sm">
                      {req.startDate} to {req.endDate}
                    </td>
                    <td className="py-4 px-5 font-bold text-white text-base">{req.days}d</td>
                    <td className="py-4 px-5">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                          req.status === "Approved"
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                            : req.status === "Pending"
                              ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                              : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                          }`}
                      >
                        {req.status}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="py-4 px-5 text-center">
                        {actionId === req.id ? (
                          <span className="text-sm font-bold text-[#DB9617]">Saving...</span>
                        ) : req.status === "Pending" ? (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleStatusUpdate(req.id, "Approved")}
                              className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-black font-bold text-xs transition cursor-pointer flex items-center gap-1.5"
                            >
                              <Check size={14} />
                              Accept
                            </button>
                            <button
                              onClick={() => handleStatusUpdate(req.id, "Rejected")}
                              className="px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5"
                            >
                              <X size={14} />
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-sm font-semibold text-neutral-400">{req.status}</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
