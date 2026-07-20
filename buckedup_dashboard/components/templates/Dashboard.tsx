"use client";

import { useState, useEffect, useMemo } from "react";
import type { CatalogProduct, ViewId } from "@/lib/types";
import type { BuckyCatalogContext, BuckyProductContext } from "@/lib/bucky/systemPrompt";
import { parseModalKey } from "@/lib/utils";
import { useAuth } from "@/lib/useAuth";
import { useVideoRequests } from "@/lib/useVideoRequests";
import { useCatalog } from "@/lib/useCatalog";
import { useStageDeliverables } from "@/lib/useStageDeliverables";
import { createClient } from "@/lib/supabase/client";
import { AppHeader } from "@/components/organisms/AppHeader";
import { TabBar } from "@/components/organisms/TabBar";
import { OverviewView } from "@/components/templates/OverviewView";
import { CatalogView } from "@/components/templates/CatalogView";
import { VideoLibraryView, type LibraryProductFocus } from "@/components/templates/VideoLibraryView";
import { VideoModal } from "@/components/organisms/VideoModal";
import { AnalyticsView } from "@/components/templates/AnalyticsView";
import { AdminView } from "@/components/templates/AdminView";
import { PlanningView } from "@/components/templates/PlanningView";
import { BuckyConversationsView } from "@/components/templates/BuckyConversationsView";
import { BuckyWidget } from "@/components/organisms/BuckyWidget";
import { ForcePasswordChangeView } from "@/components/auth/ForcePasswordChangeView";
import { ReviewsView } from "@/components/templates/ReviewsView";

export function Dashboard() {
  const [activeView, setActiveView] = useState<ViewId>("overview");
  const [theme, setTheme] = useState<"dark" | "light">("light");
  const [modalKey, setModalKey] = useState<string | null>(null);
  const [librarySearch, setLibrarySearch] = useState<string | null>(null);
  const [reviewRankToOpen, setReviewRankToOpen] = useState<number | null>(null);
  const { products, loading, error } = useVideoRequests();
  const { catalog, loading: catalogLoading, error: catalogError } = useCatalog(true);
  const { currentByKey } = useStageDeliverables();
  const { role, mustChangePassword, theme: savedTheme, user } = useAuth();

  // Bucky's product-selection context (Phase 3b). libraryFocus covers
  // VideoLibraryView's review/production/edit-form modals (reported up via
  // its onProductFocus callback); modalKey covers the plain video-preview
  // modal, already-lifted state from the original (cheap) pass. libraryFocus
  // takes priority when both are somehow set, since it represents more
  // deliberate in-progress work than a passive preview.
  const [libraryFocus, setLibraryFocus] = useState<LibraryProductFocus | null>(null);
  const [catalogFocus, setCatalogFocus] = useState<CatalogProduct | null>(null);

  const currentProduct = useMemo<BuckyProductContext | null>(() => {
    if (libraryFocus) {
      const item = libraryFocus.product.items[0];
      return {
        rank: libraryFocus.product.rank,
        name: libraryFocus.product.name,
        status: item?.status ?? null,
        source: libraryFocus.source,
      };
    }
    if (!modalKey) return null;
    const { rank, index } = parseModalKey(modalKey);
    const product = products.find((p) => p.rank === rank);
    if (!product) return null;
    const item = product.items[index];
    return { rank: product.rank, name: product.name, status: item?.status ?? null, source: "preview" };
  }, [libraryFocus, modalKey, products]);

  const currentCatalogProduct = useMemo<BuckyCatalogContext | null>(() => {
    if (!catalogFocus) return null;
    return { id: catalogFocus.id, name: catalogFocus.name };
  }, [catalogFocus]);

  const switchView = (view: ViewId) => {
    setActiveView(view);
  };

  const toggleTheme = async () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    if (user) {
      const supabase = createClient();
      await supabase.rpc("update_my_theme", { new_theme: newTheme });
    }
  };

  useEffect(() => {
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, [savedTheme]);

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

  // Route guard: prevent operators from accessing analytics
  useEffect(() => {
    if (role === "operator" && activeView === "analytics") {
      setActiveView("overview");
    }
  }, [role, activeView]);

  const handleNotificationNavigate = (productName: string) => {
    setLibrarySearch(productName);
    setActiveView("library");
  };

  const pendingReviewsCount = useMemo(() => {
    if (role !== "lead" && role !== "admin") return 0;
    

    let count = 0;
    for (const product of products) {
      if (product.deliveryType !== "pipeline") continue;
      

      const status = product.items[0]?.status;
      if (!status) continue;
      

      if (status === "In Review") {
        count++;
      } else if (status === "Design") {
        const sb = currentByKey.get(`${product.id}:Storyboarding`);
        const sc = currentByKey.get(`${product.id}:Scripting`);
        if ((sb && sb.decision === "pending") || (sc && sc.decision === "pending")) {
          count++;
        }
      }
    }
    return count;
  }, [products, currentByKey, role]);

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
          pendingReviewsCount={pendingReviewsCount}
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
            onNavigateToProduct={(productName) => {
              setLibrarySearch(productName);
              switchView("library");
            }}
          />
        </div>
        <div className={`view${activeView === "catalog" ? " active" : ""}`}>
          <CatalogView
            catalog={catalog}
            products={products}
            loading={catalogLoading}
            error={catalogError}
            onNavigateToLibrary={() => switchView("library")}
            onProductFocus={setCatalogFocus}
          />
        </div>
        <div className={`view${activeView === "library" ? " active" : ""}`}>
          <VideoLibraryView
            products={products}
            currentByKey={currentByKey}
            loading={loading}
            error={error}
            onOpenModal={setModalKey}
            externalSearch={librarySearch}
            onExternalSearchApplied={() => setLibrarySearch(null)}
            externalReviewRank={reviewRankToOpen}
            onExternalReviewRankApplied={() => setReviewRankToOpen(null)}
            theme={theme}
            onProductFocus={setLibraryFocus}
          />
        </div>
        {(role === "lead" || role === "admin") ? (
          <div className={`view${activeView === "reviews" ? " active" : ""}`}>
            <ReviewsView
              products={products}
              currentByKey={currentByKey}
              onReviewProduct={(rank) => {
                setReviewRankToOpen(rank);
                switchView("library");
              }}
            />
          </div>
        ) : null}
        <div className={`view${activeView === "analytics" ? " active" : ""}`}>
          <AnalyticsView products={products} />
        </div>
        {role === "admin" ? (
          <div className={`view${activeView === "admin" ? " active" : ""}`}>
            <AdminView />
          </div>
        ) : null}
        {role === "admin" ? (
          <div className={`view${activeView === "planning" ? " active" : ""}`}>
            <PlanningView />
          </div>
        ) : null}
        {role === "admin" ? (
          <div className={`view${activeView === "bucky" ? " active" : ""}`}>
            <BuckyConversationsView />
          </div>
        ) : null}
      </div>
      <VideoModal
        products={products}
        modalKey={modalKey}
        onClose={() => setModalKey(null)}
      />
      <BuckyWidget
        activeView={activeView}
        currentProduct={currentProduct}
        currentCatalogProduct={currentCatalogProduct}
        products={products}
      />
    </div>
  );
}
