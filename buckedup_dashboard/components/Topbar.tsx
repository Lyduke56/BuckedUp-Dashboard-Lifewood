"use client";

import { useEffect, useState } from "react";
import type { ViewId } from "@/lib/types";

const PAGE_TITLES: Record<ViewId, string> = {
  overview: "Overview",
  library: "Video library",
};

interface TopbarProps {
  activeView: ViewId;
  loading: boolean;
  lastUpdated: Date | null;
  onRefresh: () => void;
}

export function Topbar({
  activeView,
  loading,
  lastUpdated,
  onRefresh,
}: TopbarProps) {
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
    <div className="topbar">
      <div className="page-title">{PAGE_TITLES[activeView]}</div>
      <div className="topbar-right">
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
    </div>
  );
}
