"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setSubmitting(false);
      setError(signInError.message);
      return;
    }

    router.push("/");
    router.refresh();
  };

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="brand-row login-brand-row">
          <img
            src="/lifewood-full-cream.svg"
            alt="Lifewood"
            className="brand-logo login-brand-logo"
          />
          <span className="brand-divider-line login-brand-divider" />
          <img
            src="/buckedup.svg"
            alt="BuckedUp"
            className="brand-logo"
            style={{ width: "30px" }}
          />
        </div>
        <h1 className="login-title">Sign in</h1>
        <p className="login-sub">
          Sign in to add, edit, or resolve items on the dashboard. Everyone
          can still view it without an account.
        </p>
        {error ? <div className="callout login-error">{error}</div> : null}
        <label className="login-field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            autoFocus
            required
          />
        </label>
        <label className="login-field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <button type="submit" className="login-submit-btn" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>
        <Link className="login-back-link" href="/">
          ← Back to dashboard
        </Link>
      </form>
    </div>
  );
}
