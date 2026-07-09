"use client";

import type { ReactNode } from "react";
import type { ViewId } from "@/lib/types";
import {
  AnalyticsIcon,
  FolderIcon,
  OverviewIcon,
  UsersIcon,
} from "@/components/shared/icons";

interface TabBarProps {
  activeView: ViewId;
  onViewChange: (view: ViewId) => void;
  showAdmin: boolean;
}

const BASE_TABS: { id: ViewId; label: string; icon: () => ReactNode }[] = [
  { id: "overview", label: "Overview", icon: OverviewIcon },
  { id: "library", label: "Video Library", icon: FolderIcon },
  { id: "analytics", label: "Analytics", icon: AnalyticsIcon },
];

const ADMIN_TAB: { id: ViewId; label: string; icon: () => ReactNode } = {
  id: "admin",
  label: "Admin",
  icon: UsersIcon,
};

export function TabBar({ activeView, onViewChange, showAdmin }: TabBarProps) {
  const tabs = showAdmin ? [...BASE_TABS, ADMIN_TAB] : BASE_TABS;

  return (
    <nav className="tab-bar">
      {tabs.map((tab) => {
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
