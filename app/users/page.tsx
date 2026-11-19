/// <reference types="next" />
"use client";

import EditUserModal from "../components/EditUserModal";
import { useState, useEffect } from "react";
import { Users, Loader2 } from "../components/icons";
import Link from "next/link";
import { useAuth } from "../components/auth-context";
import type { User } from "../components/auth-context";

// Simple Users list with inline edit
export default function UsersPage() {
  const [usersList, setUsersList] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editError, setEditError] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { user: currentUser } = useAuth();

  useEffect(() => {
    let ignore = false;
    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => {
        if (!ignore && data.success) setUsersList(data.users);
      })
      .catch((err) => console.error("Failed to load users:", err))
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const startEdit = (u: User) => {
    setSelectedUser(u);
    setModalOpen(true);
    // No need to set error here as modal handles its own errors
  };

  const handleDelete = async (u: User) => {
    if (
      !window.confirm(
        `Delete ${u.name} (${u.email})? This also removes all of their leave requests and notifications. This cannot be undone.`
      )
    ) {
      return;
    }
    setEditError("");
    setDeletingId(u.id);
    try {
      const res = await fetch(`/api/users/${u.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setEditError(data.error || "Failed to delete user");
        return;
      }
      setUsersList((prev) => prev.filter((x) => x.id !== u.id));
    } catch (err) {
      console.error("Failed to delete user:", err);
      setEditError("Failed to delete user");
    } finally {
      setDeletingId(null);
    }
  };

  const handleModalSaved = (updated: User) => {
    setUsersList((prev) =>
      prev.map((u) => (u.id === updated.id ? updated : u))
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin" size={48} />
      </div>
    );
  }

  return (
    <div className="space-y-10 max-w-6xl mx-auto py-4">
      <h1 className="text-4xl font-black text-white flex items-center gap-3">
        <Users className="text-[#DB9617]" size={36} /> Users
      </h1>

      {/* Action Buttons */}
      <div className="flex gap-3 mb-4">
        <Link
          href="/signup"
          className="bg-[#DB9617] hover:bg-[#c48512] text-[#0D0D0D] font-bold px-4 py-2 rounded"
        >
          Add User
        </Link>
        <Link
          href="/signup?admin=true"
          className="bg-[#DB9617] hover:bg-[#c48512] text-[#0D0D0D] font-bold px-4 py-2 rounded"
        >
          Add Admin
        </Link>
      </div>

      {usersList.length === 0 ? (
        <p className="text-neutral-400">No users found.</p>
      ) : (
     
<div className="overflow-x-auto">
  <table className="min-w-full divide-y divide-neutral-800 text-sm">
    <thead className="bg-neutral-900">
      <tr>
        <th className="px-4 py-2 text-left">Name</th>
        <th className="px-4 py-2 text-left">Email</th>
        <th className="px-4 py-2 text-left">Role</th>
        <th className="px-4 py-2 text-left">Department</th>
        <th className="px-4 py-2 text-left">Sick Leaves</th>
        <th className="px-4 py-2 text-left">Casual Leaves</th>
        <th className="px-4 py-2 text-left">Annual Leaves</th>
        <th className="px-4 py-2 text-left">Actions</th>
      </tr>
    </thead>

    <tbody className="divide-y divide-neutral-800">
      {usersList.map((u) => (
        <tr
          key={u.id}
          className="bg-neutral-800/30 hover:bg-neutral-800/50"
        >
          <td className="px-4 py-2">{u.name}</td>
          <td className="px-4 py-2">{u.email}</td>
          <td className="px-4 py-2">
            <span
              className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
                u.role === "admin"
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  : "bg-neutral-700/40 text-neutral-300"
              }`}
            >
              {u.role || "user"}
            </span>
          </td>
          <td className="px-4 py-2">{u.department}</td>
          <td className="px-4 py-2">{u.sickLeaves}</td>
          <td className="px-4 py-2">{u.casualLeaves}</td>
          <td className="px-4 py-2">{u.annualLeaves}</td>
          <td className="px-4 py-2">
            <div className="flex gap-2">
              <button
                onClick={() => startEdit(u)}
                className="bg-[#DB9617] text-[#0D0D0D] font-bold px-3 py-1 rounded"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(u)}
                disabled={deletingId === u.id || currentUser?.id === u.id}
                title={currentUser?.id === u.id ? "You cannot delete your own account" : undefined}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-3 py-1 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deletingId === u.id ? "Deleting..." : "Delete"}
              </button>
            </div>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>

      )}

      {editError && (
        <p className="mt-2 text-rose-400 bg-rose-500/15 p-2 rounded">
          {editError}
        </p>
      )}
      {modalOpen && selectedUser && (
        <EditUserModal
          user={selectedUser}
          onClose={() => setModalOpen(false)}
          onSaved={(updated) => {
            handleModalSaved(updated);
            setModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

