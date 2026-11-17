"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  department: string;
  sickLeaves: number;
  casualLeaves: number;
  annualLeaves: number;
  needsDetails?: number;
}

export interface LeaveBalances {
  sick: { allowed: number; used: number; remaining: number };
  casual: { allowed: number; used: number; remaining: number };
  annual: { allowed: number; used: number; remaining: number };
  wfh?: { used: number };
}

interface AuthContextType {
  user: User | null;
  balances: LeaveBalances | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  balances: null,
  loading: true,
  login: async () => ({ success: false }),
  logout: async () => {},
  refreshUser: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [balances, setBalances] = useState<LeaveBalances | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refreshUser = async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          setUser(data.user);
          if (data.balances) setBalances(data.balances);
          return;
        }
      }
      setUser(null);
      setBalances(null);
    } catch {
      setUser(null);
      setBalances(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (!ignore) {
          if (data.success && data.user) {
            setUser(data.user);
            if (data.balances) setBalances(data.balances);
          } else {
            setUser(null);
            setBalances(null);
          }
        }
      })
      .catch(() => {
        if (!ignore) {
          setUser(null);
          setBalances(null);
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  const login = async (email: string, password: string) => {
    let res: Response;
    try {
      res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
    } catch (err) {
      console.error("Login request could not reach the server:", err);
      return { success: false, error: "Cannot reach the server. Is `npm run dev` running on localhost:3000?" };
    }

    let data: { success?: boolean; user?: User; error?: string } | null = null;
    try {
      data = await res.json();
    } catch {
      console.error("Login returned non-JSON, HTTP status", res.status);
      return {
        success: false,
        error: `Server error (HTTP ${res.status}). Check the terminal running Next.js for the real error (often a database connection problem).`,
      };
    }

    if (data?.success && data.user) {
      setUser(data.user);
      await refreshUser();
      return { success: true };
    }
    return { success: false, error: data?.error || `Login failed (HTTP ${res.status})` };
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
      setBalances(null);
      router.push("/");
    }
  };

  return (
    <AuthContext.Provider value={{ user, balances, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

