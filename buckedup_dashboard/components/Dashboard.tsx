"use client";

import { useState } from "react";
import type { ViewId } from "@/lib/types";
import { useAuth } from "@/lib/useAuth";
import { useVideoRequests } from "@/lib/useVideoRequests";
import { AppHeader } from "./layout/AppHeader";
import { TabBar } from "./layout/TabBar";
import { OverviewView } from "./overview/OverviewView";
import { VideoLibraryView } from "./library/VideoLibraryView";
import { VideoModal } from "./library/VideoModal";
import { AnalyticsView } from "./analytics/AnalyticsView";
import { ManageUsersView } from "./admin/ManageUsersView";

export function Dashboard() {
  const [activeView, setActiveView] = useState<ViewId>("overview");
  const [modalKey, setModalKey] = useState<string | null>(null);
  const { products, loading, error } = useVideoRequests();
  const { role } = useAuth();

  const switchView = (view: ViewId) => {
    setActiveView(view);
  };

  return (
    <div className="shell">
      <div className="shell-header">
        <AppHeader />
        <TabBar
          activeView={activeView}
          onViewChange={switchView}
          showAdmin={role === "admin"}
        />
      </div>
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
            ⚠️ Couldn&apos;t load live data from Supabase: {error}
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
        <div className={`view${activeView === "analytics" ? " active" : ""}`}>
          <AnalyticsView products={products} />
        </div>
        {role === "admin" ? (
          <div className={`view${activeView === "admin" ? " active" : ""}`}>
            <ManageUsersView />
          </div>
        ) : null}
      </div>
      <VideoModal
        products={products}
        modalKey={modalKey}
        onClose={() => setModalKey(null)}
      />
    </div>
  );
}
