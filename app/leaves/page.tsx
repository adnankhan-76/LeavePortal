"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
 

import {
  CalendarDays,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  Check,
  X,
  Database,
  Loader2,
  Laptop,
  Eye,
} from "../components/icons";
import { useAuth } from "../components/auth-context";
import { isValidLeaveId } from "@/lib/link-safety";
import { sendLeaveEmail } from "../components/SendEmailButton";
//import SendEmailButton from "../components/SendEmailButton";

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
  createdAt?: string;
}

interface LeaveStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

interface UserBalances {
  sick: { allowed: number; used: number; remaining: number };
  casual: { allowed: number; used: number; remaining: number };
  annual: { allowed: number; used: number; remaining: number };
  wfh?: { used: number };
}

const TYPE_LABELS: Record<string, string> = {
  sick: "Sick Leave",
  casual: "Casual Leave",
  annual: "Annual Leave",
  wfh: "Work From Home",
};

function matchesType(leaveType: string, key: string) {
  const t = leaveType.toLowerCase();
  if (key === "wfh") return t.includes("work from home") || t.includes("wfh");
  return t.includes(key);
}

export default function LeavesPage() {
  return (
    <Suspense fallback={null}>
      <LeavesContent />
    </Suspense>
  );
}

function LeavesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const typeParam = (searchParams.get("type") || "").toLowerCase();
  const typeFilter = typeParam in TYPE_LABELS ? typeParam : "";
  const userFilter = searchParams.get("user") || "";
  // Deep link from the email: /leaves?leave=LV-123 (format is validated before it is used)
  const leaveParam = searchParams.get("leave");
  const deepLinkId = isValidLeaveId(leaveParam) ? leaveParam : "";
  const { user, loading: authLoading } = useAuth();
  const isAdmin = user?.role === "admin";

  const [leaves, setLeaves] = useState<LeaveItem[]>([]);
  const [stats, setStats] = useState<LeaveStats>({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [balances, setBalances] = useState<UserBalances | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"All" | "Pending" | "Approved" | "Rejected">("All");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [pickedLeave, setSelectedLeave] = useState<LeaveItem | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New leave form state
  const [newType, setNewType] = useState("Work From Home");
  const [newStartDate, setNewStartDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const [newReason, setNewReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let ignore = false;
    fetch("/api/leaves")
      .then((res) => res.json())
      .then((data) => {
        if (!ignore && data.success) {
          setLeaves(data.leaves);
          if (data.stats) setStats(data.stats);
          if (data.balances) setBalances(data.balances);
        }
      })
      .catch((err) => console.error("Failed to load leaves From Data Base", err))
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  // Reload leaves when a notification arrives (new request for admin, decision for user)
  useEffect(() => {
    const reload = () => {
      fetch("/api/leaves", { cache: "no-store" })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setLeaves(data.leaves);
            if (data.stats) setStats(data.stats);
            if (data.balances) setBalances(data.balances);
          }
        })
        .catch(() => {});
    };
    window.addEventListener("sika:notification", reload);
    return () => window.removeEventListener("sika:notification", reload);
  }, []);

  // Not signed in? Go to login and come straight back to this exact page afterwards.
  useEffect(() => {
    if (authLoading || user) return;
    const back = deepLinkId ? `/leaves?leave=${deepLinkId}` : "/leaves";
    router.replace(`/login?next=${encodeURIComponent(back)}`);
  }, [authLoading, user, deepLinkId, router]);

  // The leave named in the link. It comes from /api/leaves, which the server already limits
  // to what this person may see (admin: all, employee: own), so a link to someone else's
  // leave simply shows "not found" and never leaks data.
  const deepLinkLeave = deepLinkId ? leaves.find((l) => l.id === deepLinkId) ?? null : null;
  const deepLinkMissing = !!deepLinkId && !loading && !!user && !deepLinkLeave;
  const selectedLeave = pickedLeave ?? deepLinkLeave;

  const closeLeave = () => {
    setSelectedLeave(null);
    if (deepLinkId) router.replace("/leaves", { scroll: false });
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Admin Accept or Reject action connected to SQLite
  const handleStatusUpdate = async (id: string, newStatus: "Approved" | "Rejected") => {
    try {
      setActionLoadingId(id);
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
        if (selectedLeave && selectedLeave.id === id) {
          setSelectedLeave({ ...selectedLeave, status: newStatus });
        }
        if (data.stats) setStats(data.stats);
        showToast(
          newStatus === "Approved"
            ? `✓ Request ${id} ACCEPTED and saved to DataBase!`
            : `✗ Request ${id} REJECTED and saved to DataBase!`
        );
      } else {
        if (res.status === 409 && data.leave) {
          // Someone already decided this leave: show the real status
          setLeaves((prev) => prev.map((l) => (l.id === id ? { ...l, status: data.leave.status } : l)));
          if (selectedLeave && selectedLeave.id === id) setSelectedLeave({ ...selectedLeave, status: data.leave.status });
        }
        alert(data.error || "Failed to update status");
      }
    } catch (err) {
      console.error("Failed to update leave in Database:", err);
      alert("Error connecting to database.");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Apply new leave (Insert into SQLite)
  const handleApplyLeave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (isSubmitting) return;

    if (!newStartDate || !newEndDate) {
      alert("Please select both start and end dates.");
      return;
    }

    const start = new Date(`${newStartDate}T00:00:00`);
    const end = new Date(`${newEndDate}T00:00:00`);

    if (end < start) {
      alert("End date cannot be earlier than start date.");
      return;
    }

    const leaveDays =
      Math.floor(
        (Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) -
          Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) /
          (1000 * 60 * 60 * 24)
      ) + 1;

    if (newType === "Casual Leave" && leaveDays > 2) {
      alert("Casual leave cannot be applied for more than 2 days.");
      return;
    }

    if (newType !== "Work From Home") {
      if (!balances) {
        alert("Leave balances are still loading. Please try again in a moment.");
        return;
      }

      const balanceMap: Record<string, number | undefined> = {
        "Sick Leave": balances.sick?.remaining,
        "Casual Leave": balances.casual?.remaining,
        "Annual Leave": balances.annual?.remaining,
      };

      const remaining = balanceMap[newType];

      if (remaining === undefined) {
        alert("Invalid leave type selected.");
        return;
      }

      if (leaveDays > remaining) {
        alert(`Insufficient leave balance! You have only ${remaining} days remaining.`);
        return;
      }
    }

    const reason =
      newReason.trim() ||
      (newType === "Work From Home"
        ? "Work from home request"
        : "General leave request");

    try {
      setIsSubmitting(true);

      const res = await fetch("/api/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.id,
          employee: user?.name || "Employee",
          type: newType,
          startDate: newStartDate,
          endDate: newEndDate,
          reason,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.success === false) {
        alert(data.error || "Failed to submit leave request.");
        return;
      }

      // Close the form only after the API confirms the request was saved.
      setShowModal(false);

      // Clear the form fields for the next request.
      setNewStartDate("");
      setNewEndDate("");
      setNewReason("");
      setNewType("Work From Home");

      showToast("Leave request submitted successfully!");

      // Send the email notification without delaying the modal closing.
      // The server builds the email (with the link to this leave) from the saved record.
      void Promise.resolve(sendLeaveEmail(data.leave.id)).catch((emailError) => {
        console.error("Leave was saved, but the email notification failed:", emailError);
      });

      // Refresh the leave list, statistics, and balances.
      try {
        const refreshedResponse = await fetch("/api/leaves", {
          cache: "no-store",
        });
        const refreshed = await refreshedResponse.json();

        if (refreshed.success) {
          setLeaves(refreshed.leaves);
          if (refreshed.stats) setStats(refreshed.stats);
          if (refreshed.balances) setBalances(refreshed.balances);
        }
      } catch (refreshError) {
        // The request is already saved; a refresh failure should not report submission failure.
        console.error("Leave was saved, but the list could not be refreshed:", refreshError);
      }
    } catch (error) {
      console.error("Leave request error:", error);
      alert("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredLeaves = leaves.filter((l) => {
    const matchesFilter = filter === "All" || l.status === filter;
    const matchesTypeFilter = !typeFilter || matchesType(l.type, typeFilter);
    const matchesUserFilter = !userFilter || String(l.userId) === userFilter;
    const matchesSearch =
      l.employee.toLowerCase().includes(search.toLowerCase()) ||
      l.type.toLowerCase().includes(search.toLowerCase()) ||
      l.id.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch && matchesTypeFilter && matchesUserFilter;
  });

  const renderTypeBadge = (type: string) => {
    const lower = type.toLowerCase();
    if (lower.includes("work from home") || lower.includes("wfh")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
          <Laptop size={14} />
          Work From Home
        </span>
      );
    }
    if (lower.includes("sick")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
          Sick Leave
        </span>
      );
    }
    if (lower.includes("casual")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30">
          Casual Leave
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
        {type}
      </span>
    );
  };

  return (
    <div className="space-y-10 max-w-7xl">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-[#171717] border-2 border-[#DB9617] text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3.5 transition-all animate-bounce">
          <Database className="text-[#DB9617]" size={22} />
          <span className="text-base font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Shown when an email link points to a leave that is missing or not visible to this person */}
      {deepLinkMissing && (
        <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-sm font-semibold">
          <span>Leave request {deepLinkId} was not found, or you do not have access to it.</span>
          <button
            type="button"
            onClick={() => router.replace("/leaves", { scroll: false })}
            className="text-rose-200 hover:text-white underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
     <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 pr-10">
        <div>
          <div className="flex items-center gap-3.5">
            <h1 className="text-4xl font-black text-white tracking-tight flex items-center gap-3">
              <CalendarDays className="text-[#DB9617]" size={36} />
              {isAdmin ? "Admin Leave & WFH Management" : "My Leaves & Work From Home"}
            </h1>
          
          </div>
          {/* <p className="text-neutral-300 text-base mt-2">
            {isAdmin
              ? "Review full details of employee leave and Work From Home applications, then accept or decline."
              : `Hi ${user?.name}, apply for leave or WFH and track approvals.`}
          </p> */}
        </div>

        {/* Regular users see Apply button, Admin does NOT */}
        {!isAdmin && (
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center justify-center gap-2.5 bg-[#DB9617] hover:bg-[#c48512] text-[#0D0D0D] font-extrabold text-base px-2 py-4 rounded-2xl transition shadow-lg cursor-pointer"
          >
            <Plus size={22} />
            Apply Leave / WFH
          </button>
        )}
      </div>

      {/* If regular user, display personal balance cards: Sick, Casual, Annual, WFH */}
      {!isAdmin && balances && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
          {/* Sick Leaves */}
          <div className="bg-[#171717] border border-amber-500/30 rounded-3xl p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-amber-400 text-sm font-bold uppercase tracking-wider">Sick Leaves</span>
              <span className="text-xs text-neutral-400 font-medium">{balances.sick.used} taken</span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-4xl font-black text-white">{balances.sick.remaining}</span>
              <span className="text-sm text-neutral-400">/ {balances.sick.allowed} days left</span>
            </div>
            <div className="w-full bg-neutral-800 h-2.5 rounded-full mt-3.5 overflow-hidden">
              <div
                className="bg-amber-400 h-full rounded-full"
                style={{
                  width: `${Math.min(100, (balances.sick.remaining / (balances.sick.allowed || 1)) * 100)}%`,
                }}
              />
            </div>
          </div>

          {/* Casual Leaves */}
          <div className="bg-[#171717] border border-sky-500/30 rounded-3xl p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-sky-400 text-sm font-bold uppercase tracking-wider">Casual Leaves</span>
              <span className="text-xs text-neutral-400 font-medium">{balances.casual.used} taken</span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-4xl font-black text-white">{balances.casual.remaining}</span>
              <span className="text-sm text-neutral-400">/ {balances.casual.allowed} days left</span>
            </div>
            <div className="w-full bg-neutral-800 h-2.5 rounded-full mt-3.5 overflow-hidden">
              <div
                className="bg-sky-400 h-full rounded-full"
                style={{
                  width: `${Math.min(100, (balances.casual.remaining / (balances.casual.allowed || 1)) * 100)}%`,
                }}
              />
            </div>
          </div>

          {/* Annual Leaves */}
          <div className="bg-[#171717] border border-emerald-500/30 rounded-3xl p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-emerald-400 text-sm font-bold uppercase tracking-wider">Annual Leaves</span>
              <span className="text-xs text-neutral-400 font-medium">{balances.annual.used} taken</span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-4xl font-black text-white">{balances.annual.remaining}</span>
              <span className="text-sm text-neutral-400">/ {balances.annual.allowed} days left</span>
            </div>
            <div className="w-full bg-neutral-800 h-2.5 rounded-full mt-3.5 overflow-hidden">
              <div
                className="bg-emerald-400 h-full rounded-full"
                style={{
                  width: `${Math.min(100, (balances.annual.remaining / (balances.annual.allowed || 1)) * 100)}%`,
                }}
              />
            </div>
          </div>

          {/* Work From Home (WFH) */}
          <div className="bg-[#171717] border border-indigo-500/30 rounded-3xl p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-indigo-400 text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                <Laptop size={16} />
                Work From Home
              </span>
              <span className="text-xs text-neutral-400 font-medium">Approved</span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-4xl font-black text-white">{balances.wfh?.used ?? 0}</span>
              <span className="text-sm text-neutral-400">days taken</span>
            </div>
            <p className="text-xs text-neutral-400 mt-2 font-medium">Flexible remote work days</p>
          </div>
        </div>
      )}

      {/* Admin Summary Stats Cards */}
      {isAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
          <div className="bg-[#171717] border border-neutral-800 rounded-3xl p-6">
            <p className="text-sm font-bold text-neutral-400">Total Applications</p>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-4xl font-black text-white">{stats.total}</span>
              <span className="text-xs text-neutral-500 font-medium">In DataBase</span>
            </div>
          </div>

          <div className="bg-[#171717] border border-neutral-800 rounded-3xl p-6">
            <p className="text-sm font-bold text-amber-400 flex items-center gap-2">
              <Clock size={18} />
              Pending Admin Action
            </p>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-4xl font-black text-amber-400">{stats.pending}</span>
              <span className="text-xs text-neutral-500 font-medium">Needs review</span>
            </div>
          </div>

          <div className="bg-[#171717] border border-neutral-800 rounded-3xl p-6">
            <p className="text-sm font-bold text-emerald-400 flex items-center gap-2">
              <CheckCircle2 size={18} />
              Approved Requests
            </p>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-4xl font-black text-emerald-400">{stats.approved}</span>
              <span className="text-xs text-neutral-500 font-medium">Accepted</span>
            </div>
          </div>

          <div className="bg-[#171717] border border-neutral-800 rounded-3xl p-6">
            <p className="text-sm font-bold text-rose-400 flex items-center gap-2">
              <XCircle size={18} />
              Rejected Requests
            </p>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-4xl font-black text-rose-400">{stats.rejected}</span>
              <span className="text-xs text-neutral-500 font-medium">Declined</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Table Card */}
      <div className="bg-[#171717] border border-neutral-800 rounded-3xl p-7 space-y-6 shadow-xl">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-5">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={19} />
            <input
              type="text"
              placeholder="Search leaves & WFH by employee, type, or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-neutral-900 border border-neutral-800 rounded-2xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#DB9617]"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-neutral-900 p-1.5 rounded-2xl border border-neutral-800 self-start md:self-auto">
            {(["All", "Pending", "Approved", "Rejected"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  filter === tab
                    ? "bg-[#DB9617] text-[#0D0D0D] shadow-md"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {(typeFilter || userFilter) && (
          <div className="flex items-center gap-2 px-5 pb-4 text-xs font-bold">
            <span className="text-neutral-400">Showing:</span>
            {typeFilter && (
              <span className="px-3 py-1 rounded-full bg-[#DB9617]/15 text-[#DB9617]">
                {TYPE_LABELS[typeFilter]}
              </span>
            )}
            {userFilter && (
              <span className="px-3 py-1 rounded-full bg-neutral-800 text-neutral-200">
                {leaves.find((l) => String(l.userId) === userFilter)?.employee || "Selected employee"}
              </span>
            )}
            <button
              type="button"
              onClick={() => router.push("/leaves")}
              className="px-3 py-1 rounded-full border border-neutral-700 text-neutral-300 hover:text-white cursor-pointer"
            >
              Clear filter ✕
            </button>
          </div>
        )}

        {/* Leaves Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-16 text-center text-neutral-400 flex flex-col items-center justify-center gap-3 text-base">
              <Loader2 size={32} className="text-[#DB9617]" />
              <p className="text-base font-medium">Loading records from  database...</p>
            </div>
          ) : filteredLeaves.length === 0 ? (
            <div className="py-14 text-center text-neutral-500 text-base">
              {isAdmin
                ? "No leave requests found in the database."
                : 'No leave requests found. Click "Apply Leave / WFH" to submit a new request.'}
            </div>
          ) : (
            <table className="w-full text-left text-sm text-neutral-300">
              <thead className="border-b border-neutral-800 text-xs font-bold uppercase tracking-wider text-neutral-400">
                <tr>
                  <th className="py-4 px-5">Request ID</th>
                  <th className="py-4 px-5">Employee</th>
                  <th className="py-4 px-5">Type</th>
                  <th className="py-4 px-5">Duration</th>
                  <th className="py-4 px-5">Days</th>
                  <th className="py-4 px-5">Reason / Notes</th>
                  <th className="py-4 px-5">Status</th>
                  <th className="py-4 px-5 text-center">
                    {isAdmin ? "Admin Actions & Details" : "Details"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {filteredLeaves.map((l) => (
                  <tr key={l.id} className="hover:bg-neutral-800/30 transition">
                    <td className="py-4 px-5 font-mono text-xs text-neutral-400">{l.id}</td>
                    <td className="py-4 px-5 font-bold text-white text-base">{l.employee}</td>
                    <td className="py-4 px-5">{renderTypeBadge(l.type)}</td>
                    <td className="py-4 px-5 text-neutral-300 text-sm">
                      {l.startDate} to {l.endDate}
                    </td>
                    <td className="py-4 px-5 font-bold text-white text-base">{l.days}d</td>
                    <td className="py-4 px-5 text-neutral-300 text-sm max-w-xs truncate">{l.reason}</td>
                    <td className="py-4 px-5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                          l.status === "Approved"
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                            : l.status === "Pending"
                            ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                            : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                        }`}
                      >
                        {l.status === "Approved" && <CheckCircle2 size={13} />}
                        {l.status === "Pending" && <Clock size={13} />}
                        {l.status === "Rejected" && <XCircle size={13} />}
                        {l.status}
                      </span>
                    </td>
                    <td className="py-4 px-5">
                      <div className="flex items-center justify-center gap-2.5">
                        {/* View Details Button */}
                        <button
                          onClick={() => setSelectedLeave(l)}
                          className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5 border border-neutral-700 shadow-sm"
                          title="View Full Details"
                        >
                          <Eye size={14} />
                          Details
                        </button>

                        {/* Admin Accept / Reject Actions */}
                        {isAdmin && l.status === "Pending" && (
                          <>
                            {actionLoadingId === l.id ? (
                              <div className="flex items-center gap-2 text-xs text-[#DB9617]">
                                <Loader2 size={16} />
                              </div>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleStatusUpdate(l.id, "Approved")}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 shadow-sm"
                                  title="Accept Request"
                                >
                                  <Check size={14} />
                                  Accept
                                </button>

                                <button
                                  onClick={() => handleStatusUpdate(l.id, "Rejected")}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30 shadow-sm"
                                  title="Reject Request"
                                >
                                  <X size={14} />
                                  Reject
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Leave Details Modal (For Admin & User) */}
      {selectedLeave && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#171717] border border-neutral-800 rounded-3xl p-7 sm:p-9 w-full max-w-xl shadow-2xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-[#DB9617]/10 text-[#DB9617]">
                  <CalendarDays size={24} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-white">Leave Application Details</h3>
                  <p className="text-sm font-mono text-neutral-400 mt-0.5">{selectedLeave.id}</p>
                </div>
              </div>
              <button
                onClick={closeLeave}
                className="text-neutral-400 hover:text-white cursor-pointer"
              >
                <X size={22} />
              </button>
            </div>

            {/* Details Grid */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-5 rounded-2xl bg-neutral-900 border border-neutral-800 text-sm">
                <div>
                  <span className="text-neutral-400 text-xs font-semibold block mb-1">Employee Name</span>
                  <span className="text-white font-extrabold text-base">{selectedLeave.employee}</span>
                </div>
                <div>
                  <span className="text-neutral-400 text-xs font-semibold block mb-1">Request Type</span>
                  <div>{renderTypeBadge(selectedLeave.type)}</div>
                </div>
                <div>
                  <span className="text-neutral-400 text-xs font-semibold block mb-1">Duration</span>
                  <span className="text-white text-sm font-semibold">
                    {selectedLeave.startDate} to {selectedLeave.endDate}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-400 text-xs font-semibold block mb-1">Total Days</span>
                  <span className="text-[#DB9617] font-black text-lg">{selectedLeave.days} Day(s)</span>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-neutral-900 border border-neutral-800">
                <span className="text-neutral-400 text-xs font-bold uppercase tracking-wider">
                  Current Approval Status
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold ${
                    selectedLeave.status === "Approved"
                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                      : selectedLeave.status === "Pending"
                      ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                      : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                  }`}
                >
                  {selectedLeave.status}
                </span>
              </div>

              {/* Reason Box */}
              <div>
                <span className="text-neutral-400 text-xs font-bold uppercase tracking-wider block mb-2">
                  Reason / Notes Provided
                </span>
                <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 text-neutral-100 text-base leading-relaxed whitespace-pre-wrap">
                  {selectedLeave.reason || "No detailed reason specified."}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-neutral-800">
              <button
                type="button"
                onClick={closeLeave}
                className="px-5 py-2.5 text-sm font-bold text-neutral-400 hover:text-white cursor-pointer"
              >
                Close
              </button>

              {isAdmin && selectedLeave.status === "Pending" && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleStatusUpdate(selectedLeave.id, "Rejected")}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold transition cursor-pointer flex items-center gap-2 bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30 shadow-sm"
                  >
                    <X size={16} />
                    Reject
                  </button>
                  <button
                    onClick={() => handleStatusUpdate(selectedLeave.id, "Approved")}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold transition cursor-pointer flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg"
                  >
                    <Check size={16} />
                    Accept
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal for applying leave (only for regular users) */}
      {!isAdmin && showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[#171717] border border-neutral-800 rounded-3xl p-7 sm:p-9 w-full max-w-xl shadow-2xl space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2.5">
                <h3 className="text-2xl font-black text-white">Apply For Leave / WFH</h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-neutral-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleApplyLeave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
                  Applicant
                </label>
                <input
                  type="text"
                  disabled
                  value={`${user?.name || "Employee"} (${user?.email || ""})`}
                  className="w-full px-4 py-3 bg-neutral-900/60 border border-neutral-800 rounded-2xl text-base text-neutral-400 cursor-not-allowed font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
                  Request Type
                </label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  className="w-full px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-2xl text-base text-white focus:outline-none focus:border-[#DB9617] font-medium"
                >
                  <option value="Work From Home">💻 Work From Home (WFH)</option>
                  <option value="Sick Leave">
                    🤒 Sick Leave {balances ? `(${balances.sick.remaining} days left)` : ""}
                  </option>
                  <option value="Casual Leave">
                    🌴 Casual Leave {balances ? `(${balances.casual.remaining} days left)` : ""}
                  </option>
                  <option value="Annual Leave">
                    🏖️ Annual Leave {balances ? `(${balances.annual.remaining} days left)` : ""}
                  </option>
                 
                </select>
              </div>

             <div className="grid grid-cols-2 gap-4">
  <div>
    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
      Start Date
    </label>
    <div className="relative">
      <input
        type="date"
        required
        value={newStartDate}
        onChange={(e) => setNewStartDate(e.target.value)}
        className="w-full appearance-none px-4 pr-12 py-3 bg-neutral-900 border border-neutral-800 rounded-2xl text-base text-white focus:outline-none focus:border-[#DB9617] [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
      />
      <svg
        className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white pointer-events-none"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <rect x="3" y="5" width="18" height="16" rx="2" strokeWidth="2" />
        <path d="M16 3v4M8 3v4M3 11h18" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  </div>

  <div>
    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
      End Date
    </label>
    <div className="relative">
      <input
        type="date"
        required
        value={newEndDate}
        onChange={(e) => setNewEndDate(e.target.value)}
        className="w-full appearance-none px-4 pr-12 py-3 bg-neutral-900 border border-neutral-800 rounded-2xl text-base text-white focus:outline-none focus:border-[#DB9617] [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
      />
      <svg
        className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white pointer-events-none"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <rect x="3" y="5" width="18" height="16" rx="2" strokeWidth="2" />
        <path d="M16 3v4M8 3v4M3 11h18" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  </div>
</div>
             <div>
  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
    Reason 
  </label>
  <textarea
    rows={3}
    required
    placeholder={
      newType === "Work From Home"
        ? "Briefly describe your tasks or reason for working remotely..."
        : "Reason for requesting leave..."
    }
    value={newReason}
    onChange={(e) => setNewReason(e.target.value)}
    className="w-full px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-2xl text-base text-white placeholder-neutral-500 focus:outline-none focus:border-[#DB9617]"
  />
</div>

<div className="flex items-center justify-end gap-3 pt-3">
  <button
    type="button"
    onClick={() => setShowModal(false)}
    className="px-5 py-2.5 text-sm font-bold text-neutral-400 hover:text-white cursor-pointer"
  >
    Cancel
  </button>

  <button
    type="submit"
    disabled={isSubmitting}
    className="bg-[#DB9617] hover:bg-[#c48512] text-[#0D0D0D] font-extrabold text-base px-6 py-3 rounded-2xl transition cursor-pointer flex items-center gap-2 shadow-lg"
  >
    {isSubmitting ? (
      <>
        <Loader2 size={18} />
       Loading 
      </>
    ) : (
      "Submit Request"
    )}
  </button>
</div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
