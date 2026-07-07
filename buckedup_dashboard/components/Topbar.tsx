"use client";

import { useEffect, useState } from "react";
import type { ViewId } from "@/lib/types";

const PAGE_TITLES: Record<ViewId, string> = {
  overview: "Overview",
  library: "Video library",
};

interface TopbarProps {
  activeView: ViewId;
}

export function Topbar({ activeView }: TopbarProps) {
  const [syncSeconds, setSyncSeconds] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setSyncSeconds((prev) => (prev + 1) % 20);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="topbar">
      <div className="page-title">{PAGE_TITLES[activeView]}</div>
      <div className="topbar-right">
        <span className="readonly-badge">Read-only view</span>
        <span className="sync-indicator">
          <span className="pulse-dot" />
          Synced {syncSeconds}s ago
        </span>
      </div>
    </div>
  );
}
