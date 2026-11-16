"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, X } from "./icons";
import { useAuth } from "./auth-context";

interface NotificationItem {
  id: number;
  type: string;
  message: string;
  leaveId: string | null;
  isRead: number;
  createdAt: string;
}

const POLL_MS = 5000;

function timeAgo(iso: string) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}

function tone(type: string) {
  if (type === "leave_approved") return "border-emerald-500/40 bg-emerald-500/10";
  if (type === "leave_rejected") return "border-rose-500/40 bg-rose-500/10";
  return "border-[#DB9617]/40 bg-[#DB9617]/10";
}

// Bell + popup toasts shown at the top right of the screen (admin and user).
export default function NotificationBell() {
  const { user, refreshUser } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [toasts, setToasts] = useState<NotificationItem[]>([]);
  const lastToastedId = useRef<number>(-1);
  const initialised = useRef(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (!data.success) return;
      const list: NotificationItem[] = data.notifications;
      setItems(list);
      setUnread(data.unread);

      if (!initialised.current) {
        initialised.current = true;
        const stored = Number(sessionStorage.getItem("sika_last_toast") || "-1");
        lastToastedId.current = stored;
      }

      const fresh = list
        .filter((n) => !n.isRead && n.id > lastToastedId.current)
        .sort((a, b) => a.id - b.id);

      if (fresh.length > 0) {
        lastToastedId.current = fresh[fresh.length - 1].id;
        sessionStorage.setItem("sika_last_toast", String(lastToastedId.current));
        setToasts((prev) => [...prev, ...fresh.slice(-3)]);
        // Tell pages (leaves / home) to reload their data, and refresh leave balances
        window.dispatchEvent(new CustomEvent("sika:notification"));
        refreshUser();
        fresh.slice(-3).forEach((n) => {
          setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== n.id)), 6000);
        });
      }
    } catch {
      // ignore network errors, next poll will retry
    }
  }, [refreshUser]);

  useEffect(() => {
    if (!user) return;
    const first = setTimeout(load, 0);
    const timer = setInterval(load, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [user, load]);

  const markAllRead = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, isRead: 1 })));
    setUnread(0);
    await fetch("/api/notifications", { method: "PATCH" });
  };

  const markOneRead = async (id: number) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: 1 } : n)));
    setUnread((u) => Math.max(0, u - 1));
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  };

  if (!user) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col items-end gap-3">
      {/* Bell */}
      <div className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className="relative w-12 h-12 rounded-full bg-[#1a1a1a] border border-neutral-700 hover:border-[#DB9617] text-white flex items-center justify-center shadow-xl cursor-pointer transition"
          aria-label="Notifications"
        >
          <Bell size={22} />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[11px] font-black flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute right-0 mt-3 w-[22rem] max-h-[26rem] overflow-y-auto rounded-2xl bg-[#141414] border border-neutral-700 shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 sticky top-0 bg-[#141414]">
              <span className="font-extrabold text-sm">Notifications</span>
              {unread > 0 && (
                <button onClick={markAllRead} className="text-xs font-bold text-[#DB9617] hover:underline cursor-pointer">
                  Mark all read
                </button>
              )}
            </div>
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-neutral-500">No notifications yet</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => !n.isRead && markOneRead(n.id)}
                  className={`w-full text-left px-4 py-3 border-b border-neutral-800/70 hover:bg-neutral-800/50 transition cursor-pointer ${
                    n.isRead ? "opacity-60" : ""
                  }`}
                >
                  <p className="text-sm font-semibold leading-snug">{n.message}</p>
                  <p className="text-xs text-neutral-500 mt-1">{timeAgo(n.createdAt)}</p>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Popup toasts */}
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`w-[22rem] rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur bg-[#141414] flex items-start gap-3 ${tone(t.type)}`}
        >
          <p className="flex-1 text-sm font-bold leading-snug">{t.message}</p>
          <button
            onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
            className="text-neutral-400 hover:text-white cursor-pointer"
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
