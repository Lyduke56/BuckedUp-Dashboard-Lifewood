"use client";

import { useState } from "react";
import type { ViewId } from "@/lib/types";
import { OverviewView } from "./OverviewView";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { VideoLibraryView } from "./VideoLibraryView";
import { VideoModal } from "./VideoModal";

export function Dashboard() {
  const [activeView, setActiveView] = useState<ViewId>("overview");
  const [modalKey, setModalKey] = useState<string | null>(null);

  const switchView = (view: ViewId) => {
    setActiveView(view);
  };

  return (
    <div className="shell">
      <Sidebar activeView={activeView} onViewChange={switchView} />
      <div className="main-area">
        <Topbar activeView={activeView} />
        <div className="content">
          <div className={`view${activeView === "overview" ? " active" : ""}`}>
            <OverviewView onBrowseLibrary={() => switchView("library")} />
          </div>
          <div className={`view${activeView === "library" ? " active" : ""}`}>
            <VideoLibraryView onOpenModal={setModalKey} />
          </div>
        </div>
      </div>
      <VideoModal modalKey={modalKey} onClose={() => setModalKey(null)} />
    </div>
  );
}
