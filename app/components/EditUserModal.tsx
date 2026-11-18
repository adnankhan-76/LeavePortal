
"use client";

import { useState, useEffect } from "react";
import {
  Users,
  CheckCircle2,
  ArrowRight,
  Loader2,
  Building2,
} from "./icons";
import type { User } from "../components/auth-context";

export default function EditUserModal({
  user,
  onClose,
  onSaved,
}: {
  user: User | null;
  onClose: () => void;
  onSaved: (updated: User) => void;
}) {
  const [formData, setFormData] = useState<User>(
    user ?? {
      id: "",
      name: "",
      email: "",
      role: "user",
      department: "Engineering",
      sickLeaves: 0,
      casualLeaves: 0,
      annualLeaves: 0,
    }
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Update form data when a new user is passed
  useEffect(() => {
    if (user) {
      setFormData(user);
    }
  }, [user]);

  const toNum = (v: number | "") => (v === "" ? 0 : v);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError("");
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
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
        onSaved(data.user);
        onClose();
      } else {
        setError(data.error || "Update failed");
      }
    } catch {
      setError("Could not reach the server");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/30 z-50">
      <div className="bg-neutral-900 rounded-xl p-6 w-full max-w-lg shadow-2xl">
        <h2 className="text-2xl font-black text-white flex items-center gap-3 mb-4">
          <Users className="text-[#DB9617]" size={28} /> Edit User
        </h2>
        {error && (
          <p className="text-rose-400 bg-rose-500/15 p-2 rounded mb-3">{error}</p>
        )}
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-neutral-400 mb-1">
              Full Name
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-neutral-400 mb-1">
              Email
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
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
                                <option value="Engineering">Engineering</option>
                                <option value="Marketing">Marketing</option>
                                <option value="Human Resources">Human Resources</option>
                              <option value="Support">Support</option>
                                <option value="Operations">Operations</option>
                              </select>
                            </div>
                          </div>
            <div>
              <label className="block text-xs font-bold uppercase text-neutral-400 mb-1">
                Sick Leaves
              </label>
              <input
                type="number"
                min={0}
                value={formData.sickLeaves as number}
                onChange={(e) => setFormData({ ...formData, sickLeaves: parseInt(e.target.value) })}
                className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-neutral-400 mb-1">
                Casual Leaves
              </label>
              <input
                type="number"
                min={0}
                value={formData.casualLeaves as number}
                onChange={(e) => setFormData({ ...formData, casualLeaves: parseInt(e.target.value) })}
                className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-neutral-400 mb-1">
                Annual Leaves
              </label>
              <input
                type="number"
                min={0}
                value={formData.annualLeaves as number}
                onChange={(e) => setFormData({ ...formData, annualLeaves: parseInt(e.target.value) })}
                className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-white"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="bg-neutral-600 text-white px-4 py-2 rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-[#DB9617] text-[#0D0D0D] font-bold px-4 py-2 rounded"
            >
              {isSubmitting ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

