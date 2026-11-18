/// <reference types="next" />
"use client";

import EditUserModal from "../components/EditUserModal";
import { useState, useEffect } from "react";
import { Users, Loader2 } from "../components/icons";
import Link from "next/link";
import type { User } from "../components/auth-context";

// Simple Users list with inline edit
export default function UsersPage() {
  const [usersList, setUsersList] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editError, setEditError] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

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
                <th className="px-4 py-2 text-left">Department</th>
                <th className="px-4 py-2 text-left">Leaves (S/C/A)</th>
                <th className="px-4 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {usersList.map((u) => (
                <tr key={u.id} className="bg-neutral-800/30 hover:bg-neutral-800/50">
                  <td className="px-4 py-2">{u.name}</td>
                  <td className="px-4 py-2">{u.email}</td>
                  <td className="px-4 py-2">{u.department}</td>
                  <td className="px-4 py-2">{`${u.sickLeaves}/${u.casualLeaves}/${u.annualLeaves}`}</td>
                  <td className="px-4 py-2 space-x-2">
                    <button
                      onClick={() => startEdit(u)}
                      className="bg-[#DB9617] text-[#0D0D0D] font-bold px-3 py-1 rounded"
                    >
                      Edit
                    </button>
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

