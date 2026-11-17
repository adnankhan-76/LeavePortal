"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn, Mail, Lock, ArrowRight, Loader2 } from "./components/icons";
import { useAuth } from "./components/auth-context";
import { safeNextPath } from "@/lib/link-safety";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(searchParams.get("error") || "");
  // Where to go after login (e.g. the leave link from the email). Validated: same-site, allowlisted pages only.
  const nextPath = safeNextPath(searchParams.get("next"));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }

    setLoading(true);
    const result = await login(email, password);
    setLoading(false);

    if (result.success) {
      router.push(nextPath ?? "/home");
    } else {
      setError(result.error || "Invalid email or password");
    }
  };



  return (
    <div className="w-full max-w-md">
      <div className="bg-[#171717] border border-neutral-800 rounded-3xl p-8 sm:p-10 shadow-2xl space-y-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#DB9617]/10 text-[#DB9617] text-xs font-bold uppercase tracking-wider mb-3">
            <LogIn size={14} />
            Sika Portal Access
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Sign In</h1>
          <p className="text-neutral-400 text-sm mt-1">
            Log in as Admin or Employee with your DataBase credentials.
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
              <input
                type="email"
                required
                placeholder="name@sikka.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#DB9617]"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Password
              </label>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#DB9617]"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="remember"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="rounded bg-neutral-900 border-neutral-800 text-[#DB9617] focus:ring-[#DB9617]"
              />
              <label htmlFor="remember" className="text-xs text-neutral-400">
                Remember this device
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#DB9617] hover:bg-[#c48512] text-[#0D0D0D] font-bold py-3.5 rounded-xl transition shadow-lg mt-2 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Verifying Credentials...
              </>
            ) : (
              <>
                Sign In
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="flex items-center gap-3 text-neutral-600 text-xs">
          <div className="h-px flex-1 bg-neutral-800" />
          OR
          <div className="h-px flex-1 bg-neutral-800" />
        </div>

        <a
          href={nextPath ? `/api/auth/google?next=${encodeURIComponent(nextPath)}` : "/api/auth/google"}
          className="w-full flex items-center justify-center gap-3 bg-white hover:bg-neutral-200 text-[#0D0D0D] font-bold py-3.5 rounded-xl transition cursor-pointer"
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/>
            <path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.600 2.600 10.800l7.900-6.100z"/>
            <path fill="#34A853" d="M24 48c6.500 0 11.9-2.1 15.900-5.800l-7.500-5.800c-2.1 1.4-4.800 2.300-8.400 2.300-6.300 0-11.600-4.100-13.500-9.800l-7.900 6.100C6.500 42.600 14.600 48 24 48z"/>
          </svg>
          Sign in with Google (@sikka.com.pk)
        </a>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
