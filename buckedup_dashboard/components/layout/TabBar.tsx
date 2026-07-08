"use client";

import type { ReactNode } from "react";
import type { ViewId } from "@/lib/types";
import { AnalyticsIcon, FolderIcon, OverviewIcon } from "@/components/shared/icons";

interface TabBarProps {
  activeView: ViewId;
  onViewChange: (view: ViewId) => void;
}

const TABS: { id: ViewId; label: string; icon: () => ReactNode }[] = [
  { id: "overview", label: "Overview", icon: OverviewIcon },
  { id: "library", label: "Video Library", icon: FolderIcon },
  { id: "analytics", label: "Analytics", icon: AnalyticsIcon },
];

export function TabBar({ activeView, onViewChange }: TabBarProps) {
  return (
    <nav className="tab-bar">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            className={`tab-bar-item${activeView === tab.id ? " active" : ""}`}
            onClick={() => onViewChange(tab.id)}
          >
            <Icon />
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
