"use client";

import Link from "next/link";
import { useAuth } from "@/lib/useAuth";

export function AppHeader() {
  const { user, loading: authLoading, signOut } = useAuth();

  return (
    <header className="app-header">
      <div className="brand-row">
        <img
          src="/lifewood-full-cream.svg"
          alt="Lifewood"
          className="brand-logo"
        />
        <span className="brand-divider-line" />
        <img
          src="/buckedup.svg"
          alt="BuckedUp"
          className="brand-logo"
          style={{ width: "30px" }}
        />
      </div>
      <div className="app-header-right">
        {authLoading ? null : user ? (
          <div className="auth-status">
            <span className="auth-email">{user.email}</span>
            <button type="button" className="header-btn" onClick={signOut}>
              Sign out
            </button>
          </div>
        ) : (
          <Link href="/login" className="header-badge login-link">
            Sign in to edit
          </Link>
        )}
      </div>
    </header>
  );
}
