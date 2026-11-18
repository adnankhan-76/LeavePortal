"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import {
  UserPlus,
  Mail,
  Lock,
  User as UserIcon,
  Building2,
  CheckCircle2,
  ArrowRight,
  CalendarDays,
  Loader2,
  Users,
} from "../components/icons";
import type { User } from "../components/auth-context";
import { useSearchParams, useRouter } from "next/navigation";

const DEPARTMENTS = ["Engineering", "Marketing", "Human Resources", "Support", "Operations", "General"];

type LeaveValue = number | "";

type FormData = {
  name: string;
  email: string;
  password: string;
  
  sickLeaves: LeaveValue;
  casualLeaves: LeaveValue;
  annualLeaves: LeaveValue;
};

type Editing = FormData & { kind: "user" | "admin"; id: string };

const DEFAULT_FORM: FormData = {
  name: "",
  email: "",
  password: "",
  department: "Engineering",
  sickLeaves: 7,
  casualLeaves: 14,
  annualLeaves: 15,
};

// Empty input stays empty while typing; becomes 0 on save
const parseLeave = (v: string): LeaveValue => (v === "" ? "" : parseInt(v) || 0);
const toNum = (v: LeaveValue): number => (v === "" ? 0 : v);

function AddUserForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const editId = searchParams?.get("editId") ?? null;
  const isEdit = Boolean(editId);

  const [formData, setFormData] = useState<FormData>(DEFAULT_FORM);
  const [prefilledFor, setPrefilledFor] = useState<string | null>(null);

  const [mode, setMode] = useState<"user" | "admin">("user");
  const [adminForm, setAdminForm] = useState({ name: "", email: "", password: "" });
  const [adminsList, setAdminsList] = useState<{ id: string; name: string; email: string }[]>([]);
  const [adminMsg, setAdminMsg] = useState("");

  const [editing, setEditing] = useState<Editing | null>(null);
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const [usersList, setUsersList] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [submittedUser, setSubmittedUser] = useState<User | null>(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load users
  useEffect(() => {
    let ignore = false;
    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => {
        if (!ignore && data.success) setUsersList(data.users);
      })
      .catch((err) => console.error("Failed to load users:", err))
      .finally(() => {
        if (!ignore) setLoadingUsers(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  // Load admins
  useEffect(() => {
    let ignore = false;
    fetch("/api/admins")
      .then((res) => res.json())
      .then((data) => {
        if (!ignore && data.success) setAdminsList(data.admins);
      })
      .catch((err) => console.error("Failed to load admins:", err));
    return () => {
      ignore = true;
    };
  }, []);

  // Prefill the main form when arriving with ?editId=...
  useEffect(() => {
    if (!editId || prefilledFor === editId) return;
    const u = usersList.find((x) => x.id === editId);
    if (!u) return;
    setFormData({
      name: u.name,
      email: u.email,
      password: "",
      department: u.department,
      sickLeaves: u.sickLeaves,
      casualLeaves: u.casualLeaves,
      annualLeaves: u.annualLeaves,
    });
    setPrefilledFor(editId);
  }, [editId, usersList, prefilledFor]);

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setAdminMsg("");
    try {
      setIsSubmitting(true);
      const res = await fetch("/api/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(adminForm),
      });
      const data = await res.json();
      if (data.success) {
        setAdminsList((prev) => [...prev, data.admin]);
        setAdminForm({ name: "", email: "", password: "" });
        setAdminMsg(`Admin ${data.admin.email} created.`);
      } else {
        setError(data.error || "Failed to add admin");
      }
    } catch {
      setError("Could not reach the server");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setEditError("");
    setEditSaving(true);
    try {
      const url = editing.kind === "admin" ? `/api/admins/${editing.id}` : `/api/users/${editing.id}`;
      const payload =
        editing.kind === "admin"
          ? { name: editing.name, email: editing.email, password: editing.password }
          : {
              name: editing.name,
              email: editing.email,
              password: editing.password,
              department: editing.department,
              sickLeaves: toNum(editing.sickLeaves),
              casualLeaves: toNum(editing.casualLeaves),
              annualLeaves: toNum(editing.annualLeaves),
            };
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) {
        setEditError(data.error || "Update failed");
        return;
      }
      if (editing.kind === "admin") {
        setAdminsList((prev) => prev.map((a) => (a.id === editing.id ? data.admin : a)));
      } else {
        setUsersList((prev) => prev.map((u) => (u.id === editing.id ? { ...u, ...data.user } : u)));
      }
      setEditing(null);
    } catch {
      setEditError("Could not reach the server");
    } finally {
      setEditSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.name || !formData.email || (!isEdit && !formData.password)) {
      setError(
        isEdit ? "Please fill out name and email." : "Please fill out name, email, and password."
      );
      return;
    }

    try {
      setIsSubmitting(true);
      const url = isEdit ? `/api/users/${editId}` : "/api/users";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          sickLeaves: toNum(formData.sickLeaves),
          casualLeaves: toNum(formData.casualLeaves),
          annualLeaves: toNum(formData.annualLeaves),
        }),
      });

      const data = await res.json();
      if (data.success) {
        if (isEdit) {
          setSubmittedUser(null);
          router.push("/users");
        } else {
          setSubmittedUser(data.user);
          setUsersList((prev) => [data.user, ...prev]);
        }
        setFormData(DEFAULT_FORM);
      } else {
        setError(data.error || (isEdit ? "Failed to update user" : "Failed to add user"));
      }
    } catch {
      setError("Error saving user to database");
    } finally {
      setIsSubmitting(false);
    }
  };

  const setEditField = (key: "name" | "email" | "password" | "department", value: string) =>
    setEditing((prev) => (prev ? { ...prev, [key]: value } : prev));

  const setEditLeave = (key: "sickLeaves" | "casualLeaves" | "annualLeaves", value: string) =>
    setEditing((prev) => (prev ? { ...prev, [key]: parseLeave(value) } : prev));

  return (
    <div className="space-y-10 max-w-6xl mx-auto py-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
        <div>
          <div className="flex items-center gap-3.5">
            <h1 className="text-4xl font-black text-white tracking-tight flex items-center gap-3">
              <UserPlus className="text-[#DB9617]" size={36} />
              {isEdit ? "Edit User" : "Add New User"}
            </h1>
          </div>
        </div>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-3">
        {(["user", "admin"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError("");
              setAdminMsg("");
            }}
            className={`px-5 py-2.5 rounded-xl font-bold text-sm cursor-pointer transition ${
              mode === m
                ? "bg-[#DB9617] text-[#0D0D0D]"
                : "border border-neutral-800 text-neutral-300 hover:border-neutral-600"
            }`}
          >
            {m === "user" ? "Add User" : "Add Admin"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Form Column */}
        <div className="lg:col-span-7 bg-[#171717] border border-neutral-800 rounded-3xl p-7 sm:p-9 shadow-xl">
          {mode === "admin" ? (
            <form onSubmit={handleAddAdmin} className="space-y-6">
              <div className="border-b border-neutral-800 pb-3 mb-2">
                <h3 className="text-xl font-bold text-white">New Admin Account</h3>
                <p className="text-sm text-neutral-400 mt-0.5">Admins can add and edit users and admins.</p>
              </div>
              {error && (
                <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-sm font-bold">
                  {error}
                </div>
              )}
              {adminMsg && (
                <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-sm font-bold">
                  {adminMsg}
                </div>
              )}
              {(["name", "email", "password"] as const).map((f) => (
                <div key={f}>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
                    {f === "name" ? "Full Name" : f === "email" ? "Admin Email" : "Login Password"}
                  </label>
                  <input
                    type={f === "password" ? "password" : f === "email" ? "email" : "text"}
                    required
                    value={adminForm[f]}
                    onChange={(e) => setAdminForm({ ...adminForm, [f]: e.target.value })}
                    className="w-full px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-2xl text-base text-white focus:outline-none focus:border-[#DB9617]"
                  />
                </div>
              ))}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#DB9617] hover:bg-[#c48512] text-[#0D0D0D] font-black text-lg py-4 rounded-2xl transition cursor-pointer disabled:opacity-70"
              >
                {isSubmitting ? "Saving..." : "Create Admin"}
              </button>
            </form>
          ) : submittedUser ? (
            <div className="text-center py-8 space-y-5">
              <div className="w-18 h-18 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
                <CheckCircle2 size={42} />
              </div>
              <h2 className="text-3xl font-black text-white">User Account Created!</h2>
              <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 text-left space-y-3 text-base max-w-md mx-auto">
                <div className="flex justify-between">
                  <span className="text-neutral-400 font-medium">Name:</span>
                  <span className="text-white font-bold">{submittedUser.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400 font-medium">Email:</span>
                  <span className="text-white font-mono">{submittedUser.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400 font-medium">Department:</span>
                  <span className="text-neutral-200">{submittedUser.department}</span>
                </div>
                <div className="border-t border-neutral-800 pt-3 flex justify-between font-bold">
                  <span className="text-neutral-400">Allocated Leaves:</span>
                  <span className="text-[#DB9617]">
                    Sick: {submittedUser.sickLeaves} • Casual: {submittedUser.casualLeaves} • Annual:{" "}
                    {submittedUser.annualLeaves}
                  </span>
                </div>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row gap-3.5 justify-center">
                <button
                  type="button"
                  onClick={() => setSubmittedUser(null)}
                  className="inline-flex items-center justify-center gap-2.5 bg-[#DB9617] hover:bg-[#c48512] text-[#0D0D0D] font-extrabold text-base px-6 py-3.5 rounded-2xl transition cursor-pointer shadow-lg"
                >
                  <UserPlus size={20} />
                  Add Another User
                </button>
                <Link
                  href="/home"
                  className="px-6 py-3.5 rounded-2xl text-neutral-300 hover:text-white border border-neutral-800 hover:border-neutral-700 transition text-base font-bold inline-flex items-center justify-center gap-2"
                >
                  Back to Dashboard
                  <ArrowRight size={18} />
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="border-b border-neutral-800 pb-3 mb-2">
                <h3 className="text-xl font-bold text-white">User Credentials & Profile</h3>
                <p className="text-sm text-neutral-400 mt-0.5">Set the login details for this user.</p>
              </div>

              {error && (
                <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-sm font-bold">
                  {error}
                </div>
              )}

              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={20} />
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 bg-neutral-900 border border-neutral-800 rounded-2xl text-base text-white placeholder-neutral-500 focus:outline-none focus:border-[#DB9617]"
                  />
                </div>
              </div>

              {/* Email & Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
                    User Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={20} />
                    <input
                      type="email"
                      required
                      autoComplete="off"
                      placeholder="john@sikka.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full pl-12 pr-4 py-3 bg-neutral-900 border border-neutral-800 rounded-2xl text-base text-white placeholder-neutral-500 focus:outline-none focus:border-[#DB9617]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
                    {isEdit ? "New Password (leave blank to keep)" : "Login Password"}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={20} />
                    <input
                      type="password"
                      required={!isEdit}
                      autoComplete="new-password"
                      placeholder="e.g. user123"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full pl-12 pr-4 py-3 bg-neutral-900 border border-neutral-800 rounded-2xl text-base text-white placeholder-neutral-500 focus:outline-none focus:border-[#DB9617]"
                    />
                  </div>
                </div>
              </div>

              {/* Department */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
                  Department
                </label>
                <div className="relative">
                  <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={20} />
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 bg-neutral-900 border border-neutral-800 rounded-2xl text-base text-white focus:outline-none focus:border-[#DB9617]"
                  >
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Leave allocations */}
              <div className="pt-4 border-t border-neutral-800">
                <div className="flex items-center gap-2.5 mb-3.5">
                  <CalendarDays size={20} className="text-[#DB9617]" />
                  <h4 className="text-base font-bold text-white">Set User Leave Allocations</h4>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {(
                    [
                      ["sickLeaves", "Sick Leaves", "text-amber-400", "e.g. 7 days"],
                      ["casualLeaves", "Casual Leaves", "text-sky-400", "e.g. 14 days"],
                      ["annualLeaves", "Annual Leaves", "text-emerald-400", "e.g. 15 days"],
                    ] as const
                  ).map(([key, label, color, hint]) => (
                    <div key={key}>
                      <label className={`block text-xs font-bold uppercase tracking-wider ${color} mb-1.5`}>
                        {label}
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={formData[key]}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setFormData({ ...formData, [key]: parseLeave(e.target.value) })}
                        className="w-full px-3 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-base text-white font-black text-center focus:outline-none focus:border-[#DB9617]"
                      />
                      <span className="text-xs text-neutral-500 block text-center mt-1">{hint}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#DB9617] hover:bg-[#c48512] text-[#0D0D0D] font-black text-lg py-4 rounded-2xl transition shadow-xl mt-3 cursor-pointer flex items-center justify-center gap-2.5 disabled:opacity-70"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Saving User
                  </>
                ) : (
                  <>
                    <UserPlus size={20} />
                    {isEdit ? "Save Changes" : "Create User"}
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Users column */}
        <div className="lg:col-span-5 bg-[#171717] border border-neutral-800 rounded-3xl p-7 shadow-xl space-y-5 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
            <div className="flex items-center gap-2.5">
              <Users size={22} className="text-[#DB9617]" />
              <h3 className="text-lg font-bold text-white">Users ({usersList.length})</h3>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[500px] space-y-3.5 pr-1">
            {loadingUsers ? (
              <div className="py-10 text-center text-neutral-500 flex items-center justify-center gap-2 text-base">
                <Loader2 size={18} className="animate-spin" />
                Loading users...
              </div>
            ) : usersList.length === 0 ? (
              <div className="py-10 text-center text-neutral-500 text-base">
                No users added yet. Fill out the form to add the first user!
              </div>
            ) : (
              usersList.map((u) => (
                <div
                  key={u.id}
                  className="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800/80 hover:border-neutral-700 transition space-y-2.5"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-extrabold text-white text-base">
                        {u.name}
                        {u.needsDetails ? (
                          <span className="ml-2 px-2 py-0.5 rounded-md bg-[#DB9617]/20 text-[#DB9617] text-[10px] font-black uppercase align-middle">
                            Details pending
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-neutral-400 font-mono mt-0.5">{u.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditError("");
                        setEditing({
                          kind: "user",
                          id: u.id,
                          name: u.name,
                          email: u.email,
                          password: "",
                          department: u.department,
                          sickLeaves: u.sickLeaves,
                          casualLeaves: u.casualLeaves,
                          annualLeaves: u.annualLeaves,
                        });
                      }}
                      className="px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-[#DB9617]/20 text-[#DB9617] hover:bg-[#DB9617] hover:text-[#0D0D0D] cursor-pointer transition"
                    >
                      Edit
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1.5 border-t border-neutral-800/60">
                    <span className="text-neutral-400 font-medium">{u.department}</span>
                    <span className="text-[#DB9617] font-bold">
                      Sick: {u.sickLeaves} | Casual: {u.casualLeaves} | Annual: {u.annualLeaves}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Admins list */}
      <div className="bg-[#171717] border border-neutral-800 rounded-3xl p-7 shadow-xl space-y-4">
        <h3 className="text-lg font-bold text-white">Admins ({adminsList.length})</h3>
        {adminsList.map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800/80"
          >
            <div>
              <p className="font-extrabold text-white">{a.name}</p>
              <p className="text-xs text-neutral-400 font-mono">{a.email}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditError("");
                setEditing({
                  kind: "admin",
                  id: a.id,
                  name: a.name,
                  email: a.email,
                  password: "",
                  department: "",
                  sickLeaves: 0,
                  casualLeaves: 0,
                  annualLeaves: 0,
                });
              }}
              className="px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-[#DB9617]/20 text-[#DB9617] hover:bg-[#DB9617] hover:text-[#0D0D0D] cursor-pointer transition"
            >
              Edit
            </button>
          </div>
        ))}
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-lg bg-[#171717] border border-neutral-800 rounded-3xl p-7 space-y-4"
          >
            <h3 className="text-xl font-black text-white">
              Edit {editing.kind === "admin" ? "Admin" : "User"}
            </h3>
            {editError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-sm font-bold">
                {editError}
              </div>
            )}
            {(
              [
                ["name", "Name", "text"],
                ["email", "Email", "email"],
                ["password", "New password (leave blank to keep)", "password"],
              ] as const
            ).map(([k, label, type]) => (
              <div key={k}>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
                  {label}
                </label>
                <input
                  type={type}
                  required={k !== "password"}
                  autoComplete={k === "password" ? "new-password" : "off"}
                  value={editing[k]}
                  onChange={(e) => setEditField(k, e.target.value)}
                  className="w-full px-4 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-white focus:outline-none focus:border-[#DB9617]"
                />
              </div>
            ))}
            {editing.kind === "user" && (
              <>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
                    Department
                  </label>
                  <select
                    value={editing.department}
                    onChange={(e) => setEditField("department", e.target.value)}
                    className="w-full px-4 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-white"
                  >
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {(["sickLeaves", "casualLeaves", "annualLeaves"] as const).map((k) => (
                    <div key={k}>
                      <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
                        {k.replace("Leaves", "")}
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={editing[k]}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setEditLeave(k, e.target.value)}
                        className="w-full px-3 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-white text-center font-black"
                      />
                    </div>
                  ))}
                </div>
              </>
            )}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={editSaving}
                className="flex-1 bg-[#DB9617] text-[#0D0D0D] font-black py-3 rounded-xl cursor-pointer disabled:opacity-70"
              >
                {editSaving ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-5 py-3 rounded-xl border border-neutral-700 text-neutral-300 font-bold cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// useSearchParams() must be rendered under a Suspense boundary
export default function AddUserPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 flex items-center justify-center text-neutral-500 gap-2">
          <Loader2 size={20} className="animate-spin" />
          Loading...
        </div>
      }
    >
      <AddUserForm />
    </Suspense>
  );
}