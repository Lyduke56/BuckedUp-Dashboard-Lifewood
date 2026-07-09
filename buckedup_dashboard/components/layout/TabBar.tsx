"use client";

import type { ReactNode } from "react";
import type { ViewId } from "@/lib/types";
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
  showAdmin: boolean;
}

const BASE_TABS: { id: ViewId; label: string; icon: (props: any) => ReactNode }[] = [
  { id: "overview", label: "Overview", icon: OverviewIcon },
  { id: "library", label: "Video Library", icon: FolderIcon },
  { id: "analytics", label: "Analytics", icon: AnalyticsIcon },
];

const ADMIN_TAB: { id: ViewId; label: string; icon: (props: any) => ReactNode } = {
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
                  background: "linear-gradient(135deg, rgba(255, 179, 71, 0.25) 0%, rgba(255, 157, 0, 0.05) 100%)",
                  borderRadius: "24px",
                  zIndex: 0,
                  boxShadow: "0 0 15px rgba(255, 179, 71, 0.3)",
                  border: "1px solid rgba(255, 179, 71, 0.5)",
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
