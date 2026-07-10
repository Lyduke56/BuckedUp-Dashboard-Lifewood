/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Tilt } from "@/components/shared/Tilt";

const MailIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="input-icon"
  >
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

const LockIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="input-icon"
  >
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);


const SignInIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ marginLeft: "8px", display: "inline-block" }}
  >
    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
    <polyline points="10 17 15 12 10 7" />
    <line x1="15" y1="12" x2="3" y2="12" />
  </svg>
);

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
      <Tilt maxTilt={4} className="login-tilt-container" style={{ width: "100%", maxWidth: "680px" }}>
        <form className="login-card" onSubmit={handleSubmit}>
          <div className="brand-row login-brand-row">
            <img
              src="/lifewood-full-cream.svg"
              alt="Lifewood"
              className="brand-logo login-brand-logo"
            />
            <span className="brand-divider-line login-brand-divider" />
            <img
              src="/buckedup-alt.svg"
              alt="BuckedUp"
              className="brand-logo"
            />
          </div>

          <div className="login-header-group">
            <h1 className="login-title">Video Production Monitor</h1>
            <div className="login-badge-wrap">
              <span className="login-badge">Secure Access</span>
            </div>
          </div>

          <p className="login-sub">
            AIGC video queues monitoring & pipeline administration. Authorized partners sign in to manage, edit, and update video tasks.
          </p>

          {error ? <div className="callout login-error">{error}</div> : null}

          <div className="login-fields-container" style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            <label className="login-field">
              <span>Email Address</span>
              <div className="input-with-icon">
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  autoFocus
                  required
                  placeholder="name@company.com"
                />
                <MailIcon />
              </div>
            </label>

            <label className="login-field">
              <span>Password</span>
              <div className="input-with-icon">
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                />
                <LockIcon />
              </div>
            </label>
          </div>

          <button type="submit" className="login-submit-btn" disabled={submitting}>
            <span>{submitting ? "Authenticating…" : "Sign In"}</span>
            {!submitting && <SignInIcon />}
          </button>
        </form>
      </Tilt>
    </div>
  );
}
