"use client";

import { useMemo, useState } from "react";
import type { Product } from "@/lib/types";
import { getModalKey } from "@/lib/utils";
import { PageHeader } from "@/components/molecules/PageHeader";
import { STATUS_CLASS } from "@/lib/data";
import { useProfiles } from "@/lib/useProfiles";

const LANGUAGE_FLAG: Record<string, string> = {
  English: "🇺🇸",
  Spanish: "🇪🇸",
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
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  const { profiles } = useProfiles();
  const profileEmailById = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile.email])),
    [profiles],
  );

  const [appliedExternalSearch, setAppliedExternalSearch] = useState<string | null | undefined>(undefined);
  if (externalSearch && externalSearch !== appliedExternalSearch) {
    setAppliedExternalSearch(externalSearch);
    setSearchTerm(externalSearch);
    if (externalSearch) onExternalSearchApplied?.();
  }

  // Filter ONLY published videos
  let displayProducts = products.filter(p => p.items[0]?.status === "Published");

  // Get unique product names from published videos for the dropdown
  const productNames = Array.from(new Set(displayProducts.map(p => p.name))).sort();

  // 1. Filter by Search Term
  if (searchTerm.trim()) {
    const q = searchTerm.toLowerCase();
    displayProducts = displayProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.subcategory.toLowerCase().includes(q)
    );
  }

  // 2. Filter by Product Featured (Name)
  if (selectedCategory !== "All") {
    displayProducts = displayProducts.filter(p => p.name === selectedCategory);
  }

  // 3. Sort by Age
  displayProducts.sort((a, b) => {
    // Fallback to createdAt if publishDate is missing
    const dateA = new Date(a.publishDate || a.createdAt).getTime();
    const dateB = new Date(b.publishDate || b.createdAt).getTime();
    return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
  });

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
        <div className="library-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '24px', paddingTop: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', maxWidth: '800px', margin: '0 auto' }}>
            {/* Search Bar */}
            <div style={{ position: 'relative', display: 'flex', width: '100%' }}>
              <input
                type="text"
                className="search-input"
                style={{ 
                  paddingLeft: '44px', 
                  height: '44px',
                  width: '100%',
                  borderRadius: '22px',
                  background: 'var(--header-bg, rgba(255,255,255,0.05))',
                  border: '1px solid var(--border-color)',
                  color: 'var(--ink)',
                  fontSize: '15px'
                }}
                placeholder="Search published videos…"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
              <svg
                style={{
                  position: 'absolute',
                  left: '16px',
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
                strokeWidth="2.5"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
            </div>

            {/* Filters Row */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                style={{
                  height: "38px",
                  borderRadius: "12px",
                  padding: "0 12px",
                  border: "1px solid var(--border-color)",
                  backgroundColor: "var(--bg-card, rgba(255,255,255,0.05))",
                  color: "var(--ink)",
                  fontSize: "14px",
                  outline: "none",
                  cursor: "pointer",
                  maxWidth: "300px"
                }}
              >
                <option value="All">All Products Featured</option>
                {productNames.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>

              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as any)}
                style={{
                  height: "38px",
                  borderRadius: "12px",
                  padding: "0 12px",
                  border: "1px solid var(--border-color)",
                  backgroundColor: "var(--bg-card, rgba(255,255,255,0.05))",
                  color: "var(--ink)",
                  fontSize: "14px",
                  outline: "none",
                  cursor: "pointer"
                }}
              >
                <option value="newest">Sort by Age (Newest First)</option>
                <option value="oldest">Sort by Age (Oldest First)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="library-body isolated-scroll" style={{ padding: '24px 32px' }}>
          {displayProducts.length === 0 ? (
            <div className="empty-state">No published videos found.</div>
          ) : (
            <div className="video-list">
              {displayProducts.map((product, index) => {
                const item = product.items[0];
                const modalKey = getModalKey(product.rank, 0);
                const displayRank = index + 1; // Since it's a filtered list, we show their sequential rank instead of absolute DB rank to avoid gaps

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

                return (
                  <div key={product.rank} className="video-list-card-wrap">
                    <div
                      className="video-list-card"
                      onClick={() => onOpenModal(modalKey)}
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
                        <div className="vlc-title" title={product.name}>
                          {product.name}
                        </div>
                        <div className="vlc-pills">
                          <span className={`status-pill ${priorityClass} font-bold mr-1`}>{priority} PRIORITY</span>
                          <span className="vlc-tag">{product.category}</span>
                          <span className="vlc-tag vlc-tag-sub">{product.subcategory}</span>
                          {product.deliveryType === "link" ? (
                            <span className="vlc-tag vlc-tag-link">Link-only</span>
                          ) : null}
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
