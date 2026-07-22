"use client";

import { useState } from "react";
import type { Product } from "@/lib/types";
import { getModalKey } from "@/lib/utils";
import { PageHeader } from "@/components/molecules/PageHeader";

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
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '32px'
          }}>
            {[...Array(8)].map((_, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{
                  width: '100%',
                  aspectRatio: '16/9',
                  borderRadius: '12px',
                  background: 'var(--header-border, rgba(150, 150, 150, 0.2))',
                  animation: 'skeleton-pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                }} />
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'var(--header-border, rgba(150, 150, 150, 0.2))',
                    animation: 'skeleton-pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                  }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '6px' }}>
                    <div style={{ height: '16px', width: '85%', background: 'var(--header-border, rgba(150, 150, 150, 0.2))', borderRadius: '4px', animation: 'skeleton-pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
                    <div style={{ height: '12px', width: '60%', background: 'var(--header-border, rgba(150, 150, 150, 0.2))', borderRadius: '4px', animation: 'skeleton-pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite', opacity: 0.7 }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <style>{`
            @keyframes skeleton-pulse {
              0%, 100% { opacity: 0.6; }
              50% { opacity: 0.2; }
            }
          `}</style>
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

        <div className="library-body isolated-scroll" style={{ padding: '32px' }}>
          {displayProducts.length === 0 ? (
            <div className="empty-state">No published videos found.</div>
          ) : (
            <div className="thumb-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '32px'
            }}>
              {displayProducts.map((product) => {
                const publishedDate = product.publishDate
                  ? new Date(`${product.publishDate}T00:00:00`).toLocaleDateString("en-US", { timeZone: "UTC" })
                  : "";

                return (
                  <button
                    key={product.rank}
                    type="button"
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}
                    onClick={() => onOpenModal(getModalKey(product.rank, 0))}
                  >
                    <div style={{
                      width: '100%',
                      aspectRatio: '16/9',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      background: 'var(--card-bg)',
                      border: '1px solid var(--border-color)',
                      position: 'relative'
                    }}>
                      {product.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={product.thumbnailUrl} alt={`${product.name} thumbnail`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--ink-soft)' }}>
                          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <path d="M21 15l-5-5L5 21" />
                          </svg>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: 'var(--accent, #f8cb00)',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#000',
                        fontWeight: 'bold',
                        fontSize: '16px'
                      }}>
                        {product.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{
                          fontWeight: 600,
                          fontSize: '15px',
                          color: 'var(--ink)',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          lineHeight: '1.3'
                        }}>
                          {product.name}
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--ink-soft)' }}>
                          {product.category} • {product.subcategory}
                        </div>
                        {publishedDate && (
                          <div style={{ fontSize: '12px', color: 'var(--ink-soft)', opacity: 0.8 }}>
                            {publishedDate}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
