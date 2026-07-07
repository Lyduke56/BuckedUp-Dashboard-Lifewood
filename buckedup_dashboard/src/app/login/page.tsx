"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Placeholder sign-in screen. Wire this up to real auth (e.g. Supabase
 * email/password or SSO) when the authorization system is built — the
 * middleware and route groups are already set up to gate the dashboard
 * behind this page, so only the logic in handleSubmit needs to change.
 */
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      setError("Enter an email and password to continue.");
      return;
    }
    // Mock session cookie until real auth is wired up.
    document.cookie = "buckedup_session=mock; path=/; max-age=86400";
    const redirectTo = searchParams.get("from") || "/overview";
    router.push(redirectTo);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-card border border-line bg-white p-8 shadow-sm"
      >
        <div className="mb-6 flex items-center gap-2">
          <span className="h-3.5 w-3.5 rotate-45 rounded-sm bg-saffron" />
          <div>
            <div className="text-[15.5px] font-bold leading-tight text-serpent">
              Lifewood
            </div>
            <div className="text-[11px] font-semibold text-castleton">
              × BuckedUp
            </div>
          </div>
        </div>

        <h1 className="mb-1 text-lg font-extrabold text-serpent">Sign in</h1>
        <p className="mb-6 text-[12.5px] font-medium text-ink-soft">
          Authorized production staff only.
        </p>

        <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-soft">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@lifewood.com"
          className="mb-4 w-full rounded-lg border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-castleton"
        />

        <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-soft">
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="mb-4 w-full rounded-lg border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-castleton"
        />

        {error && (
          <p className="mb-4 text-[12.5px] font-semibold text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="w-full rounded-lg bg-serpent py-2.5 text-sm font-bold text-white transition hover:bg-[#0a1f14]"
        >
          Sign in
        </button>

        <p className="mt-4 text-center text-[11px] text-ink-soft">
          This is a placeholder screen — real authentication and roles land
          with the authorization milestone.
        </p>
      </form>
    </main>
  );
}
