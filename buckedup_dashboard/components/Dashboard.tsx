"use client";

import { useState, useEffect } from "react";
import type { ViewId, Product } from "@/lib/types";
import { OverviewView } from "./OverviewView";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { VideoLibraryView } from "./VideoLibraryView";
import { VideoModal } from "./VideoModal";

export function Dashboard() {
  const [activeView, setActiveView] = useState<ViewId>("overview");
  const [modalKey, setModalKey] = useState<string | null>(null);
  const [productsList, setProductsList] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const switchView = (view: ViewId) => {
    setActiveView(view);
  };

  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);
        const res = await fetch("/api/videos");
        if (!res.ok) {
          throw new Error(`HTTP error ${res.status}`);
        }
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          // Map CSV row structure to Product[] structure
          const mapped: Product[] = json.data.map((row: any) => {
            const rank = Number(row.Rank) || 0;
            const name = row.Product || "";
            const category = row.Category || "Uncategorized";
            const subcategory = row.Subcategory || "";
            const type = row["Content Type"] || "";
            const status = row.Status || "Not Started";
            const videoUrl = row["Video URL"] || null;
            const variant = row["Content Angle"] || undefined;

            return {
              rank,
              name,
              category,
              subcategory,
              price: "", // CSV doesn't have a price column
              type,
              items: [
                {
                  name: `${name}${type ? ` — ${type}` : ""}`,
                  status: status as any,
                  videoUrl,
                  variant,
                },
              ],
            };
          });
          setProductsList(mapped);
          setError(null);
        } else {
          throw new Error(json.error || "Failed to parse spreadsheet data");
        }
      } catch (err: any) {
        console.error("Failed to fetch live spreadsheet data:", err);
        setError(err?.message || "Failed to load live data");
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div className="shell">
      <Sidebar activeView={activeView} onViewChange={switchView} />
      <div className="main-area">
        <Topbar activeView={activeView} />
        <div className="content">
          {error && (
            <div className="callout" style={{ borderLeft: "4px solid #dc3545", color: "#b02a37", marginBottom: "20px", background: "rgba(220, 53, 69, 0.05)" }}>
              ⚠️ Running in fallback mode. Failed to load live Google Sheets data: {error}
            </div>
          )}
          <div className={`view${activeView === "overview" ? " active" : ""}`}>
            <OverviewView products={productsList} isLoading={isLoading} hasError={!!error} onBrowseLibrary={() => switchView("library")} />
          </div>
          <div className={`view${activeView === "library" ? " active" : ""}`}>
            <VideoLibraryView products={productsList} onOpenModal={setModalKey} />
          </div>
        </div>
      </div>
      <VideoModal modalKey={modalKey} products={productsList} onClose={() => setModalKey(null)} />
    </div>
  );
}

