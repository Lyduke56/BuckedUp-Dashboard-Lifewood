"use client";

import { useEffect, useState } from "react";

interface AppHeaderProps {
  loading: boolean;
  lastUpdated: Date | null;
  onRefresh: () => void;
}

export function AppHeader({ loading, lastUpdated, onRefresh }: AppHeaderProps) {
  const [syncSeconds, setSyncSeconds] = useState<number | null>(null);

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
        <span className="readonly-badge">Read-only view</span>
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
