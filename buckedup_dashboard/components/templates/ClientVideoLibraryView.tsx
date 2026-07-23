"use client";

import { useEffect, useMemo, useState } from "react";
import type { FeedbackReaction, Product } from "@/lib/types";
import { getModalKey } from "@/lib/utils";
import { PageHeader } from "@/components/molecules/PageHeader";
import { STATUS_CLASS } from "@/lib/data";
import { useProfiles } from "@/lib/useProfiles";
import { useAllFeedbackSummary } from "@/lib/useFeedback";

const LANGUAGE_FLAG: Record<string, string> = {
  English: "🇺🇸",
  Spanish: "🇪🇸",
};

const REACTION_EMOJI: Record<FeedbackReaction, string> = {
  loved: "🔥",
  good: "👍",
  neutral: "😐",
  needs_work: "👎",
  unsatisfied: "❌",
};

function languageFlag(language: string): string {
  return LANGUAGE_FLAG[language] ?? "🌐";
}

interface ClientVideoLibraryViewProps {
  products: Product[];
  loading: boolean;
  error: string | null;
  onOpenModal: (key: string) => void;
  externalSearch?: string | null;
  onExternalSearchApplied?: () => void;
}

export function ClientVideoLibraryView({
  products,
  loading,
  error,
  onOpenModal,
  externalSearch,
  onExternalSearchApplied,
}: ClientVideoLibraryViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>("All");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [viewFilter, setViewFilter] = useState<"all" | "unviewed" | "viewed" | "feedbacked" | "recents">("all");

  const [viewedProductIds, setViewedProductIds] = useState<Set<string>>(new Set());

  // Load viewed product IDs from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem("buckedup_client_viewed_videos");
      if (raw) setViewedProductIds(new Set(JSON.parse(raw)));
    } catch {}
  }, []);

  const handleOpenVideoModal = (modalKey: string, productId: string) => {
    if (productId && !viewedProductIds.has(productId)) {
      const updated = new Set(viewedProductIds);
      updated.add(productId);
      setViewedProductIds(updated);
      try {
        localStorage.setItem("buckedup_client_viewed_videos", JSON.stringify(Array.from(updated)));
      } catch {}
    }
    onOpenModal(modalKey);
  };

  const { profiles } = useProfiles();
  const profileEmailById = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile.email])),
    [profiles],
  );

  const { feedbackProductIds, reactionsByProduct } = useAllFeedbackSummary();

  const [appliedExternalSearch, setAppliedExternalSearch] = useState<string | null | undefined>(undefined);
  if (externalSearch && externalSearch !== appliedExternalSearch) {
    setAppliedExternalSearch(externalSearch);
    setSearchTerm(externalSearch);
    setSelectedCategory("All");
    setSelectedSubcategory("All");
    setViewFilter("all");
    if (externalSearch) onExternalSearchApplied?.();
  }

  // Base pool: Filter ONLY published videos for the client dashboard
  const publishedProducts = useMemo(() => {
    return products.filter((p) => p.items[0]?.status === "Published");
  }, [products]);

  const unviewedCount = useMemo(() => {
    return publishedProducts.filter((p) => !viewedProductIds.has(p.id)).length;
  }, [publishedProducts, viewedProductIds]);

  const feedbackedCount = useMemo(() => {
    return publishedProducts.filter((p) => feedbackProductIds.has(p.id)).length;
  }, [publishedProducts, feedbackProductIds]);

  // Dynamically derive categories present in published videos
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    publishedProducts.forEach((p) => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats).sort();
  }, [publishedProducts]);

  // Dynamically derive subcategories present in published videos for the selected category
  const availableSubcategories = useMemo(() => {
    const subcats = new Set<string>();
    publishedProducts.forEach((p) => {
      if (selectedCategory === "All" || p.category === selectedCategory) {
        if (p.subcategory) subcats.add(p.subcategory);
      }
    });
    return Array.from(subcats).sort();
  }, [publishedProducts, selectedCategory]);

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    if (category === "All") {
      setSelectedSubcategory("All");
    } else {
      const validSubcats = new Set(
        publishedProducts
          .filter((p) => p.category === category)
          .map((p) => p.subcategory)
          .filter(Boolean)
      );
      if (!validSubcats.has(selectedSubcategory)) {
        setSelectedSubcategory("All");
      }
    }
  };

  // Filter and sort published videos dynamically
  const displayProducts = useMemo(() => {
    let list = [...publishedProducts];

    // 1. Filter by Search Term
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.subcategory.toLowerCase().includes(q)
      );
    }

    // 2. Filter by Category
    if (selectedCategory !== "All") {
      list = list.filter((p) => p.category === selectedCategory);
    }

    // 3. Filter by Subcategory
    if (selectedSubcategory !== "All") {
      list = list.filter((p) => p.subcategory === selectedSubcategory);
    }

    // 4. Filter by Viewing / Feedback Status
    if (viewFilter === "unviewed") {
      list = list.filter((p) => !viewedProductIds.has(p.id));
    } else if (viewFilter === "viewed") {
      list = list.filter((p) => viewedProductIds.has(p.id));
    } else if (viewFilter === "feedbacked") {
      list = list.filter((p) => feedbackProductIds.has(p.id));
    } else if (viewFilter === "recents") {
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      list = list.filter((p) => {
        const time = new Date(p.publishDate || p.createdAt).getTime();
        return time >= sevenDaysAgo;
      });
    }

    // 5. Sort by Age
    list.sort((a, b) => {
      const dateA = new Date(a.publishDate || a.createdAt).getTime();
      const dateB = new Date(b.publishDate || b.createdAt).getTime();
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });

    return list;
  }, [publishedProducts, searchTerm, selectedCategory, selectedSubcategory, viewFilter, viewedProductIds, feedbackProductIds, sortOrder]);

  if (loading && products.length === 0) {
    return (
      <div>
        <PageHeader
          title="Video Library | BuckedUp"
          overline="CATALOG"
          subtitle="Browse through the finished videos and download. You can leave feedbacks or comments."
        />
        <div className="library-container" style={{ padding: '32px' }}>
          <div className="empty-state">Loading published videos…</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Video Library | BuckedUp" overline="CATALOG" />
        <div className="empty-state">Couldn&apos;t reach Supabase: {error}</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Video Library | BuckedUp"
        overline="CATALOG"
        subtitle="Browse through the finished videos and download. You can leave feedbacks or comments."
      />
      <div className="library-container">
        <div className="library-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '20px', paddingTop: '16px', paddingLeft: '24px', paddingRight: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%', margin: '0' }}>
            {/* Top Control Bar: Search + Category + Subcategory + Sort Order in a single left-aligned row */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', width: '100%' }}>
              {/* Search Bar matching Product Catalog design */}
              <div style={{ position: 'relative', display: 'flex', flex: '1 1 280px', minWidth: '260px' }}>
                <input
                  type="text"
                  className="search-input"
                  style={{ 
                    paddingLeft: '44px', 
                    height: '40px',
                    width: '100%',
                    borderRadius: '22px',
                    background: 'var(--glass-bg)',
                    border: '1px solid var(--glass-border)',
                    color: 'var(--text-main)',
                    fontSize: '14px',
                    outline: 'none',
                  }}
                  placeholder="Search published videos…"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
                <svg
                  style={{
                    position: 'absolute',
                    left: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--ink-soft)',
                    pointerEvents: 'none'
                  }}
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.3-4.3" />
                </svg>
              </div>

              {/* Category Filter */}
              <select
                value={selectedCategory}
                onChange={(e) => handleCategoryChange(e.target.value)}
                style={{
                  height: "42px",
                  borderRadius: "12px",
                  padding: "0 12px",
                  border: "1px solid var(--border-color)",
                  backgroundColor: "var(--bg-card, rgba(255,255,255,0.05))",
                  color: "var(--ink)",
                  fontSize: "14px",
                  outline: "none",
                  cursor: "pointer",
                  minWidth: "160px",
                  flex: "0 0 auto",
                }}
              >
                <option value="All">All Categories</option>
                {availableCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              {/* Subcategory Filter */}
              <select
                value={selectedSubcategory}
                onChange={(e) => setSelectedSubcategory(e.target.value)}
                disabled={availableSubcategories.length === 0}
                style={{
                  height: "42px",
                  borderRadius: "12px",
                  padding: "0 12px",
                  border: "1px solid var(--border-color)",
                  backgroundColor: "var(--bg-card, rgba(255,255,255,0.05))",
                  color: "var(--ink)",
                  fontSize: "14px",
                  outline: "none",
                  cursor: availableSubcategories.length === 0 ? "not-allowed" : "pointer",
                  opacity: availableSubcategories.length === 0 ? 0.6 : 1,
                  minWidth: "160px",
                  flex: "0 0 auto",
                }}
              >
                <option value="All">All Subcategories</option>
                {availableSubcategories.map((subcat) => (
                  <option key={subcat} value={subcat}>
                    {subcat}
                  </option>
                ))}
              </select>

              {/* Sort Order */}
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as any)}
                style={{
                  height: "42px",
                  borderRadius: "12px",
                  padding: "0 12px",
                  border: "1px solid var(--border-color)",
                  backgroundColor: "var(--bg-card, rgba(255,255,255,0.05))",
                  color: "var(--ink)",
                  fontSize: "14px",
                  outline: "none",
                  cursor: "pointer",
                  minWidth: "180px",
                  flex: "0 0 auto",
                }}
              >
                <option value="newest">Sort by Age (Newest First)</option>
                <option value="oldest">Sort by Age (Oldest First)</option>
              </select>
            </div>

            {/* Smart View / Feedback Filter Pills - Left-Docked */}
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-start", flexWrap: "wrap", alignItems: "center" }}>
              {[
                { id: "all", label: "All Videos", count: publishedProducts.length },
                { id: "unviewed", label: "Unviewed", count: unviewedCount, badgeColor: "#f59e0b" },
                { id: "viewed", label: "Viewed Only", count: publishedProducts.length - unviewedCount },
                { id: "feedbacked", label: "Feedback Provided", count: feedbackedCount, badgeColor: "#10b981" },
                { id: "recents", label: "Recents (7 Days)" },
              ].map((pill) => {
                const isActive = viewFilter === pill.id;
                return (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setViewFilter(pill.id as any)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "6px 14px",
                      borderRadius: "20px",
                      fontSize: "13px",
                      fontWeight: isActive ? 700 : 500,
                      backgroundColor: isActive ? "rgba(16, 185, 129, 0.18)" : "rgba(255, 255, 255, 0.04)",
                      color: isActive ? "var(--castleton)" : "var(--ink-soft)",
                      border: isActive ? "1px solid var(--castleton)" : "1px solid var(--border-color, rgba(255,255,255,0.08))",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <span>{pill.label}</span>
                    {pill.count !== undefined && (
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 800,
                          padding: "1px 6px",
                          borderRadius: "10px",
                          backgroundColor: isActive ? "var(--castleton)" : (pill.badgeColor ?? "rgba(255,255,255,0.1)"),
                          color: isActive ? "#fff" : "var(--ink)",
                        }}
                      >
                        {pill.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="library-body isolated-scroll" style={{ padding: '24px 32px' }}>
          {displayProducts.length === 0 ? (
            <div className="empty-state">No published videos found for the selected filters.</div>
          ) : (
            <div className="video-list">
              {displayProducts.map((product, index) => {
                const item = product.items[0];
                const modalKey = getModalKey(product.rank, 0);
                const displayRank = index + 1;

                const priorityClass =
                  product.priority === "High"
                    ? "priority-high"
                    : product.priority === "Medium"
                      ? "priority-medium"
                      : "priority-low";
                const priority = product.priority.toUpperCase();

                const publishedText = product.publishDate
                  ? new Date(`${product.publishDate}T00:00:00`).toLocaleDateString("en-US", { timeZone: "UTC" })
                  : "—";

                const isViewed = viewedProductIds.has(product.id);
                const reactions = reactionsByProduct.get(product.id) ?? [];

                // Count unique reactions
                const reactionCounts = reactions.reduce((acc, r) => {
                  acc[r] = (acc[r] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>);

                return (
                  <div key={product.rank} className="video-list-card-wrap">
                    <div
                      className="video-list-card"
                      onClick={() => handleOpenVideoModal(modalKey, product.id)}
                    >
                      <div className="vlc-rank" title={`Index: ${displayRank}`}>{displayRank}</div>

                      <div className="vlc-thumb">
                        {product.thumbnailUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={product.thumbnailUrl} alt={`${product.name} thumbnail`} />
                        ) : (
                          <div className="vlc-thumb-placeholder">
                            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="3" width="18" height="18" rx="2" />
                              <circle cx="8.5" cy="8.5" r="1.5" />
                              <path d="M21 15l-5-5L5 21" />
                            </svg>
                          </div>
                        )}
                      </div>

                      <div className="vlc-main">
                        <div className="vlc-title" title={product.name} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span>{product.name}</span>
                          {!isViewed ? (
                            <span style={{ fontSize: "10px", fontWeight: 800, padding: "2px 6px", borderRadius: "6px", backgroundColor: "#f59e0b", color: "#000", letterSpacing: "0.05em" }}>
                              NEW
                            </span>
                          ) : null}
                        </div>
                        <div className="vlc-pills" style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "6px" }}>
                          <span className={`status-pill ${priorityClass} font-bold mr-1`}>{priority} PRIORITY</span>
                          <span className="vlc-tag">{product.category}</span>
                          <span className="vlc-tag vlc-tag-sub">{product.subcategory}</span>
                          {product.deliveryType === "link" ? (
                            <span className="vlc-tag vlc-tag-link">Link-only</span>
                          ) : null}

                          {/* Render aggregate qualitative reactions */}
                          {Object.entries(reactionCounts).map(([reactKey, count]) => {
                            const emoji = REACTION_EMOJI[reactKey as FeedbackReaction];
                            if (!emoji) return null;
                            return (
                              <span
                                key={reactKey}
                                style={{
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  padding: "2px 8px",
                                  borderRadius: "12px",
                                  backgroundColor: "rgba(16, 185, 129, 0.12)",
                                  color: "var(--castleton)",
                                  border: "1px solid rgba(16, 185, 129, 0.25)",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "3px",
                                }}
                              >
                                {emoji} {count > 1 ? count : ""}
                              </span>
                            );
                          })}
                        </div>
                        <div className="vlc-meta">
                          Date Published: {publishedText}
                          <span className="vlc-meta-sep"> · </span>
                          {languageFlag(product.language)} {product.language}
                          <span className="vlc-meta-sep"> · </span>
                          Owner: <span style={{ color: product.ownerId ? "var(--castleton)" : "var(--ink-soft)", fontWeight: product.ownerId ? "bold" : "normal" }}>
                            {product.ownerId ? (profileEmailById.get(product.ownerId) ?? "Assigned") : "Unassigned"}
                          </span>
                        </div>
                        {product.contentAngle ? (
                          <div className="vlc-desc">{product.contentAngle}</div>
                        ) : null}
                      </div>

                      <div
                        className="vlc-side"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <div className="vlc-side-top" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span className={`status-pill ${STATUS_CLASS[item.status]}`}>
                            {item.status.toUpperCase()}
                          </span>

                          <div className="row-actions">
                            {item.videoUrl ? (
                              <a
                                href={item.videoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                download
                                className="row-action-btn row-action-edit"
                                title="Download video"
                                style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                              >
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                  <polyline points="7 10 12 15 17 10" />
                                  <line x1="12" y1="15" x2="12" y2="3" />
                                </svg>
                              </a>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

