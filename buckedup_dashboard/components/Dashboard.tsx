"use client";

import { useState } from "react";
import type { ViewId } from "@/lib/types";
import { useVideoRequests } from "@/lib/useVideoRequests";
import { OverviewView } from "./OverviewView";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { VideoLibraryView } from "./VideoLibraryView";
import { VideoModal } from "./VideoModal";

export function Dashboard() {
  const [activeView, setActiveView] = useState<ViewId>("overview");
  const [modalKey, setModalKey] = useState<string | null>(null);
  const { products, loading, error, lastUpdated, refresh } =
    useVideoRequests();

  const switchView = (view: ViewId) => {
    setActiveView(view);
  };

  return (
    <div className="shell">
      <Sidebar activeView={activeView} onViewChange={switchView} />
      <div className="main-area">
        <Topbar
          activeView={activeView}
          loading={loading}
          lastUpdated={lastUpdated}
          onRefresh={refresh}
        />
        <div className="content">
          <div className={`view${activeView === "overview" ? " active" : ""}`}>
            <OverviewView onBrowseLibrary={() => switchView("library")} />
          </div>
          <div className={`view${activeView === "library" ? " active" : ""}`}>
            <VideoLibraryView
              products={products}
              loading={loading}
              error={error}
              onOpenModal={setModalKey}
            />
          </div>
        </div>
      </div>
      <VideoModal
        products={products}
        modalKey={modalKey}
        onClose={() => setModalKey(null)}
      />
    </div>
  );
}
