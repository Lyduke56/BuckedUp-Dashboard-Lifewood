/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { Tilt } from "@/components/shared/Tilt";

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

const MIN_PASSWORD_LENGTH = 8;

// Full-screen, replaces Dashboard's entire render tree — not a modal
// layered over content, so there's nothing underneath to interact with.
// Renders whenever useAuth().mustChangePassword is true (set by the
// admin-created-account flow); clears once the RPC below succeeds.
export function ForcePasswordChangeView() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [flagError, setFlagError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setFlagError(false);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      setSubmitting(false);
      setError(updateError.message);
      return;
    }

    const { error: rpcError } = await supabase.rpc("clear_must_change_password");

    setSubmitting(false);
    if (rpcError) {
      // Password already changed successfully — only the unlock step
      // failed, so this needs a distinct message, not a generic one.
      setFlagError(true);
      setError(
        "Your password was updated, but we couldn't finish unlocking your account. Please try again.",
      );
      setNewPassword("");
      setConfirmPassword("");
      return;
    }

    // Hard reload rather than router.push/refresh: useAuth's
    // mustChangePassword lives in client-side React state, seeded once by
    // an auth-state-change event — router.refresh() only re-fetches Server
    // Component data, so it wouldn't pick up the flag the RPC above just
    // cleared. A full reload remounts everything and re-reads fresh state,
    // guaranteeing the gate actually releases.
    window.location.href = "/";
  };

  return (
    <div className="login-shell">
      <Tilt maxTilt={4} className="login-tilt-container" style={{ width: "100%", maxWidth: "680px" }}>
        <form className="login-card" onSubmit={handleSubmit}>
          <div className="brand-row login-brand-row">
            <img src="/lifewood-full-cream.svg" alt="Lifewood" className="brand-logo login-brand-logo" />
            <span className="brand-divider-line login-brand-divider" />
            <img src="/buckedup-alt.svg" alt="BuckedUp" className="brand-logo" />
          </div>

          <div className="login-header-group">
            <h1 className="login-title">Set a new password</h1>
            <div className="login-badge-wrap">
              <span className="login-badge">Action required</span>
            </div>
          </div>

          <p className="login-sub">
            Your account was created with a temporary password. Choose a new
            password to continue — you won&apos;t be able to access the
            dashboard until you do.
          </p>

          {error ? (
            <div className="callout login-error">
              {error}
              {flagError ? (
                <button
                  type="button"
                  className="login-submit-btn"
                  style={{ marginTop: "10px" }}
                  disabled={submitting}
                  onClick={async () => {
                    setSubmitting(true);
                    const supabase = createClient();
                    const { error: retryError } = await supabase.rpc(
                      "clear_must_change_password",
                    );
                    setSubmitting(false);
                    if (retryError) {
                      setError(
                        "Still couldn't unlock your account. Please try again in a moment.",
                      );
                      return;
                    }
                    window.location.href = "/";
                  }}
                >
                  Retry unlocking my account
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="login-fields-container" style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            <label className="login-field">
              <span>New password</span>
              <div className="input-with-icon">
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  autoFocus
                  required
                  placeholder="••••••••"
                />
                <LockIcon />
              </div>
            </label>

            <label className="login-field">
              <span>Confirm new password</span>
              <div className="input-with-icon">
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                  placeholder="••••••••"
                />
                <LockIcon />
              </div>
            </label>
          </div>

          <button type="submit" className="login-submit-btn" disabled={submitting}>
            <span>{submitting ? "Saving…" : "Set password & continue"}</span>
          </button>
        </form>
      </Tilt>
    </div>
  );
}
