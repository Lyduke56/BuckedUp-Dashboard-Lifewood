"use client";

import { useState, useEffect } from "react";
import type { ViewId } from "@/lib/types";
import { useAuth } from "@/lib/useAuth";
import { useVideoRequests } from "@/lib/useVideoRequests";
import { useCatalog } from "@/lib/useCatalog";
import { AppHeader } from "@/components/organisms/AppHeader";
import { TabBar } from "@/components/organisms/TabBar";
import { OverviewView } from "@/components/templates/OverviewView";
import { CatalogView } from "@/components/templates/CatalogView";
import { VideoLibraryView } from "@/components/templates/VideoLibraryView";
import { VideoModal } from "@/components/organisms/VideoModal";
import { AnalyticsView } from "@/components/templates/AnalyticsView";
import { AdminView } from "@/components/templates/AdminView";
import { PlanningView } from "@/components/templates/PlanningView";
import { BuckyWidget } from "@/components/organisms/BuckyWidget";
import { ForcePasswordChangeView } from "@/components/auth/ForcePasswordChangeView";

export function Dashboard() {
  const [activeView, setActiveView] = useState<ViewId>("overview");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [modalKey, setModalKey] = useState<string | null>(null);
  const [librarySearch, setLibrarySearch] = useState<string | null>(null);
  const { products, loading, error } = useVideoRequests();
  const { catalog, loading: catalogLoading, error: catalogError } = useCatalog();
  const { role, mustChangePassword } = useAuth();

  const switchView = (view: ViewId) => {
    setActiveView(view);
  };

  const toggleTheme = () => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  };

  useEffect(() => {
    // Apply theme to the whole document so body background changes too
    document.documentElement.setAttribute("data-theme", theme);
    if (theme === "light") {
      document.body.classList.add("light");
    } else {
      document.body.classList.remove("light");
    }
  }, [theme]);

  useEffect(() => {
    // A small timeout ensures the new tab's content is painted before scrolling.
    // Target window, documentElement, and body to cover CSS overflow edge cases (e.g. body height: 100%).
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
      document.documentElement.scrollTo?.({ top: 0, behavior: "smooth" });
      document.body.scrollTo?.({ top: 0, behavior: "smooth" });
    }, 10);
  }, [activeView]);

  const handleNotificationNavigate = (productName: string) => {
    setLibrarySearch(productName);
    setActiveView("library");
  };

  // Replaces the entire dashboard shell (not layered over it) whenever an
  // admin-created account hasn't set its own password yet — nothing else
  // mounts, so there's nothing to accidentally interact with underneath.
  if (mustChangePassword) {
    return <ForcePasswordChangeView />;
  }

  return (
    <div className="shell">
      <div className="shell-header">
        <AppHeader
          theme={theme}
          onToggleTheme={toggleTheme}
          onNotificationNavigate={handleNotificationNavigate}
        />
        <TabBar
          activeView={activeView}
          onViewChange={switchView}
          role={role}
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
        <div className={`view${activeView === "catalog" ? " active" : ""}`}>
          <CatalogView
            catalog={catalog}
            products={products}
            loading={catalogLoading}
            error={catalogError}
            onNavigateToLibrary={() => switchView("library")}
          />
        </div>
        <div className={`view${activeView === "library" ? " active" : ""}`}>
          <VideoLibraryView
            products={products}
            loading={loading}
            error={error}
            onOpenModal={setModalKey}
            externalSearch={librarySearch}
            onExternalSearchApplied={() => setLibrarySearch(null)}
            theme={theme}
          />
        </div>
        <div className={`view${activeView === "analytics" ? " active" : ""}`}>
          <AnalyticsView products={products} />
        </div>
        {role === "admin" ? (
          <div className={`view${activeView === "admin" ? " active" : ""}`}>
            <AdminView />
          </div>
        ) : null}
        {role === "lead" ? (
          <div className={`view${activeView === "planning" ? " active" : ""}`}>
            <PlanningView />
          </div>
        ) : null}
      </div>
      <VideoModal
        products={products}
        modalKey={modalKey}
        onClose={() => setModalKey(null)}
      />
      <BuckyWidget />
    </div>
  );
}
