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
          {error && (
            <div
              className="callout"
              style={{
                borderLeft: "4px solid #dc3545",
                color: "#b02a37",
                marginBottom: "20px",
                background: "rgba(220, 53, 69, 0.05)",
              }}
            >
              ⚠️ Running in fallback mode. Failed to load live Google Sheets
              data: {error}
            </div>
          )}
          <div className={`view${activeView === "overview" ? " active" : ""}`}>
            <OverviewView
              products={products}
              isLoading={loading}
              hasError={!!error}
              onBrowseLibrary={() => switchView("library")}
            />
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
