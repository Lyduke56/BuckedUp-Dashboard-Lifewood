"use client";

import type { ReactNode } from "react";
import type { UserRole, ViewId } from "@/lib/types";
import {
  AnalyticsIcon,
  FolderIcon,
  OverviewIcon,
  UsersIcon,
} from "@/components/shared/icons";
import { motion } from "framer-motion";

interface TabBarProps {
  activeView: ViewId;
  onViewChange: (view: ViewId) => void;
  role: UserRole | null;
}

interface TabIconProps {
  size?: number;
}

type Tab = { id: ViewId; label: string; icon: (props: TabIconProps) => ReactNode };

const BASE_TABS: Tab[] = [
  { id: "overview", label: "Overview", icon: OverviewIcon },
  { id: "library", label: "Video Library", icon: FolderIcon },
  { id: "analytics", label: "Analytics", icon: AnalyticsIcon },
];

// The 4th tab is role-specific: Admin manages users, Lead configures the
// production plan, Operator gets no 4th tab. (Both use the same UsersIcon
// slot visually — they're never shown to the same person.)
const ADMIN_TAB: Tab = { id: "admin", label: "Admin", icon: UsersIcon };
const PLANNING_TAB: Tab = { id: "planning", label: "Planning", icon: UsersIcon };

export function TabBar({ activeView, onViewChange, role }: TabBarProps) {
  const tabs =
    role === "admin"
      ? [...BASE_TABS, ADMIN_TAB]
      : role === "lead"
        ? [...BASE_TABS, PLANNING_TAB]
        : BASE_TABS;

  return (
    <nav className="tab-bar">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeView === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            className={`tab-bar-item${isActive ? " active" : ""}`}
            onClick={() => onViewChange(tab.id)}
            style={{ position: "relative" }}
          >
            {isActive && (
              <motion.div
                layoutId="active-tab-indicator"
                className="active-tab-bg"
                initial={false}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "var(--active-tab-bg, linear-gradient(135deg, rgba(255, 179, 71, 0.25) 0%, rgba(255, 157, 0, 0.05) 100%))",
                  borderRadius: "24px",
                  zIndex: 0,
                  boxShadow: "var(--active-tab-shadow, 0 0 15px rgba(255, 179, 71, 0.3))",
                  border: "1px solid var(--active-tab-border, rgba(255, 179, 71, 0.5))",
                }}
              />
            )}
            <span style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: "8px" }}>
              <Icon size={17} />
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
