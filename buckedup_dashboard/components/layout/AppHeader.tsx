"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";

interface AppHeaderProps {
  loading: boolean;
  lastUpdated: Date | null;
  onRefresh: () => void;
}

export function AppHeader({ loading, lastUpdated, onRefresh }: AppHeaderProps) {
  const [syncSeconds, setSyncSeconds] = useState<number | null>(null);
  const { user, loading: authLoading, signOut } = useAuth();

  useEffect(() => {
    function updateSeconds() {
      setSyncSeconds(
        lastUpdated
          ? Math.max(0, Math.floor((Date.now() - lastUpdated.getTime()) / 1000))
          : null,
      );
    }
    updateSeconds();
    const interval = setInterval(updateSeconds, 1000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

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
            <button type="button" className="refresh-btn" onClick={signOut}>
              Sign out
            </button>
          </div>
        ) : (
          <Link href="/login" className="readonly-badge login-link">
            Sign in to edit
          </Link>
        )}
        <button
          type="button"
          className="refresh-btn"
          onClick={onRefresh}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
        <span className="sync-indicator">
          <span className="pulse-dot" />
          {syncSeconds === null ? "Syncing…" : `Synced ${syncSeconds}s ago`}
        </span>
      </div>
    </header>
  );
}
