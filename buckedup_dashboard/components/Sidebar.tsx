"use client";

import { FolderIcon, OverviewIcon } from "./icons";
import type { ViewId } from "@/lib/types";

interface SidebarProps {
  activeView: ViewId;
  onViewChange: (view: ViewId) => void;
}

export function Sidebar({ activeView, onViewChange }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-row">
          <img src="/lifewood-full-cream.svg" alt="Lifewood" className="brand-logo" />
          <span className="brand-divider-line" />
          <img src="/buckedup.svg" alt="BuckedUp" className="brand-logo" style={{ width: "30px" }} />
        </div>
      </div>
      <nav className="sidebar-nav">
        <button
          type="button"
          className={`nav-item${activeView === "overview" ? " active" : ""}`}
          onClick={() => onViewChange("overview")}
        >
          <OverviewIcon />
          Overview
        </button>
        <button
          type="button"
          className={`nav-item${activeView === "library" ? " active" : ""}`}
          onClick={() => onViewChange("library")}
        >
          <FolderIcon />
          Video Library
        </button>
      </nav>
      <div className="sidebar-footer">
        All Rights Reserved © 2026 Lifewood.
      </div>
    </aside>
  );
}
