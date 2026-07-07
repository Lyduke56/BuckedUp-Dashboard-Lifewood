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
        <div className="brand-word">
          <span className="diamond" />
          lifewood
        </div>
        <div className="brand-client">× BuckedUp</div>
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
          Video library
        </button>
      </nav>
      <div className="sidebar-footer">
        Read-only view.
        <br />
        Status is edited in the source Google Sheet.
      </div>
    </aside>
  );
}
