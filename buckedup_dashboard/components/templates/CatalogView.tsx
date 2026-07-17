"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Search, Plus, ExternalLink, ChevronRight, X, Edit2,
  Video, Package, LayoutGrid, List, Star, Tag, Layers, ChevronLeft, Info
} from "lucide-react";
import { createPortal } from "react-dom";
import { useMounted } from "@/lib/useMounted";
import { SearchBar } from "@/components/molecules/SearchBar";
import { FilterSidebar } from "@/components/organisms/FilterSidebar";
import { ProductGrid } from "@/components/organisms/ProductGrid";
import type { ProductData } from "@/components/organisms/ProductCard";
import { PageHeader } from "@/components/molecules/PageHeader";
import { CATEGORY_TREE } from "@/lib/data";
import { CatalogProductFormModal } from "@/components/organisms/CatalogProductFormModal";
import { useAuth } from "@/lib/useAuth";
import type { AigcStatus, CatalogProduct, Product } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

// ─── Helpers ───────────────────────────────────────────────────────────────

function getAigcStatus(catalogId: string, products: Product[]): AigcStatus {
  const match = products.find((p) => p.catalogProductId === catalogId);
  if (!match) return "none";
  if (match.items[0]?.status === "Published") return "published";
  return "in-progress";
}

function getLinkedProduct(catalogId: string, products: Product[]): Product | null {
  return products.find((p) => p.catalogProductId === catalogId) ?? null;
}

const AIGC_BADGE: Record<AigcStatus, { label: string; cls: string }> = {
  none: { label: "No Video", cls: "bg-white/5 text-[var(--ink-soft)] border-white/10" },
  "in-progress": { label: "In Progress", cls: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  published: { label: "Published", cls: "bg-[var(--castleton)]/10 text-[var(--castleton)] border-[var(--castleton)]/20" },
};

type AigcFilter = "all" | AigcStatus;
type FlagFilter = "all" | "bestseller" | "new" | "clearance";
type LayoutMode = "grid" | "list";

// ─── Component ─────────────────────────────────────────────────────────────

interface CatalogViewProps {
  catalog: CatalogProduct[];
  products: Product[];
  loading: boolean;
  error: string | null;
  onNavigateToLibrary: () => void;
  onProductFocus?: (product: CatalogProduct | null) => void;
}

export function CatalogView({
  catalog,
  products,
  loading,
  error,
  onNavigateToLibrary,
  onProductFocus,
}: CatalogViewProps) {
  const { role } = useAuth();
  const canEdit = role === "lead";

  // ── Filter state ──
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [subcategoryFilter, setSubcategoryFilter] = useState("all");
  const [aigcFilter, setAigcFilter] = useState<AigcFilter>("all");
  const [flagFilter, setFlagFilter] = useState<FlagFilter>("all");
  const [availabilityFilter, setAvailabilityFilter] = useState<"active" | "inactive" | "all">("all");
  const [layout, setLayout] = useState<LayoutMode>("grid");

  const itemsPerPage = 40;

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Scroll to top of the grid/list when page changes
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [currentPage]);

  // Reset page when filters or layout change
  // eslint-disable-next-line
  useEffect(() => {
    setCurrentPage(1);
  }, [search, categoryFilter, subcategoryFilter, aigcFilter, flagFilter, availabilityFilter, layout]);

  // ── Modal state ──
  const [formModalMode, setFormModalMode] = useState<"add" | "edit" | null>(null);
  const [editingProduct, setEditingProduct] = useState<CatalogProduct | null>(null);
  const [detailProduct, setDetailProduct] = useState<CatalogProduct | null>(null);

  // Reports the catalog item currently open in the detail view up to
  // Dashboard for Bucky's context awareness — a side effect on an external
  // system, so an effect rather than an inline call at each setter site.
  useEffect(() => {
    onProductFocus?.(detailProduct);
  }, [detailProduct, onProductFocus]);

  // ── Handlers ──
  const handleToggleActive = async (productData: ProductData, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!productData.rawCatalogProduct) return;
    const supabase = createClient();
    const newActiveState = !productData.isActive;
    
    // Optimistic UI update (requires a way to update the parent catalog state, or just refresh the page)
    // Since catalog is passed as prop, we'll mutate it locally for immediate effect, but the real fix is via subscription/refresh.
    productData.isActive = newActiveState;
    if (productData.rawCatalogProduct) productData.rawCatalogProduct.isActive = newActiveState;
    // Force re-render (hacky but works if parent doesn't auto-refresh)
    setAvailabilityFilter(prev => prev);

    await supabase
      .from("catalog_products")
      .update({ is_active: newActiveState })
      .eq("id", productData.id);
  };

  // ── Filtered catalog ──
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return catalog.filter((cp) => {
      if (q && !cp.name.toLowerCase().includes(q) && !cp.variants.some(v => v.toLowerCase().includes(q))) return false;
      if (categoryFilter !== "all" && cp.category !== categoryFilter) return false;
      if (subcategoryFilter !== "all" && cp.subcategory !== subcategoryFilter) return false;
      if (aigcFilter !== "all") {
        const status = getAigcStatus(cp.id, products);
        if (status !== aigcFilter) return false;
      }
      if (flagFilter !== "all") {
        const flag = (cp.flagStatus ?? "").toLowerCase();
        if (flagFilter === "bestseller" && !flag.includes("best seller")) return false;
        if (flagFilter === "new" && !flag.includes("new")) return false;
        if (flagFilter === "clearance" && !flag.includes("clearance")) return false;
      }
      if (availabilityFilter === "active" && !cp.isActive) return false;
      if (availabilityFilter === "inactive" && cp.isActive) return false;

      return true;
    });
  }, [catalog, search, categoryFilter, subcategoryFilter, aigcFilter, flagFilter, availabilityFilter, products]);

  // Pagination slice
  const paginatedFiltered = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filtered.slice(startIndex, startIndex + itemsPerPage);
  }, [filtered, currentPage, itemsPerPage]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));

  // ── Pagination Renderer ──
  const renderPagination = (position: "top" | "bottom" | "inline") => {
    if (totalPages <= 1) return null;

    let wrapperClasses = "flex items-center justify-between p-4 flex-shrink-0 z-10";
    if (position === "top") {
      wrapperClasses += " border-b border-[var(--glass-border)] bg-[rgba(0,0,0,0.01)] dark:bg-[rgba(255,255,255,0.01)] px-6 py-3";
    } else if (position === "bottom") {
      wrapperClasses += " border-t border-[var(--glass-border)] bg-[rgba(0,0,0,0.01)] dark:bg-[rgba(255,255,255,0.01)] rounded-b-xl mt-auto px-6 py-4";
    } else {
      wrapperClasses += " border-t border-[var(--glass-border)] mt-4 pt-4 px-2";
    }

    return (
      <div className={wrapperClasses}>
        <div className="text-sm text-[var(--ink-soft)]">
          Showing <span className="font-semibold text-[var(--text-main)]">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-semibold text-[var(--text-main)]">{Math.min(currentPage * itemsPerPage, filtered.length)}</span> of <span className="font-semibold text-[var(--text-main)]">{filtered.length}</span> results
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn-ghost-sm px-3 h-8 flex items-center gap-1 bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-main)] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg hover:bg-[var(--glass-hover)] transition-colors shadow-sm"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft size={14} /> Previous
          </button>
          <span className="text-sm font-medium text-[var(--text-main)] px-2">
            Page {currentPage} of {totalPages}
          </span>
          <button
            className="btn-ghost-sm px-3 h-8 flex items-center gap-1 bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-main)] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg hover:bg-[var(--glass-hover)] transition-colors shadow-sm"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      </div>
    );
  };

  // ── Stats summary ──
  const stats = useMemo(() => {
    const total = catalog.length;
    let published = 0;
    let inProgress = 0;
    let noVideo = 0;
    const catSet = new Set<string>();

    catalog.forEach((cp) => {
      catSet.add(cp.category);
      const st = getAigcStatus(cp.id, products);
      if (st === "published") published++;
      else if (st === "in-progress") inProgress++;
      else noVideo++;
    });

    return {
      total,
      categories: catSet.size,
      published,
      inProgress,
      noVideo,
      withVideo: published + inProgress,
    };
  }, [catalog, products]);

  // ── Categories with counts for FilterSidebar ──
  const sidebarCategories = useMemo(() => {
    const counts: Record<string, number> = {};
    catalog.forEach((p) => {
      if (p.category) {
        counts[p.category] = (counts[p.category] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [catalog]);

  // ── Transform for ProductGrid ──
  const gridProducts: ProductData[] = useMemo(() => {
    return paginatedFiltered.map((cp) => {
      const status = getAigcStatus(cp.id, products);
      const videosInProduction = products.filter(p => p.catalogProductId === cp.id && p.items[0]?.status !== "Published").length;
      return {
        id: cp.id,
        category: cp.category,
        subcategory: cp.subcategory,
        name: cp.name,
        variants: (cp.variants ?? []).join(", "),
        variantCount: String(cp.variantCount ?? (cp.variants ?? []).length),
        // MODIFIED: Strip 'from ' prefix if the product has only one variant or no variants
        price: (cp.variants?.length <= 1 || cp.variantCount <= 1) && cp.price ? cp.price.replace(/^from\s+/i, "") : (cp.price ?? ""),
        flag: cp.flagStatus ?? "",
        link: cp.productUrl ?? "",
        aigcStatus: status,
        isActive: cp.isActive,
        videosInProduction,
        rawCatalogProduct: cp,
      };
    });
  }, [paginatedFiltered, products]);

  return (
    <div>
      <PageHeader
        title="Product Catalog | BuckedUp"
        overline="DATABASE"
        subtitle="Full inventory of all BuckedUp products and variants, tracking which items have been produced for social media."
      />

      <div className="flex flex-col lg:flex-row gap-6 w-full items-start pb-6 mt-6">
        {/* ── Left Sidebar (Category Filters) ── */}
        <aside className="w-full lg:w-[320px] shrink-0 sticky top-6 self-start max-h-[calc(100vh-2rem)] overflow-y-auto custom-scrollbar">
          <FilterSidebar
            categories={sidebarCategories}
            selectedCategories={categoryFilter === "all" ? [] : [categoryFilter]}
            onCategoryChange={(cat: string) => {
              setCategoryFilter((prev) => (prev === cat ? "all" : cat));
              setSubcategoryFilter("all");
            }}
          />
        </aside>

        {/* ── Right Content ── */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden panel border-dashed max-h-[calc(100vh-2rem)]">
          {/* Header section (Filters) */}
          <div className="p-5 flex flex-col xl:flex-row gap-4 items-center justify-between flex-shrink-0">
            <div className="flex-1 w-full max-w-md">
              <SearchBar
                value={search}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-full"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              {/* AIGC Status Filter */}
              <select
                className="filter-select text-xs h-9 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-full px-3 text-[var(--text-main)] outline-none"
                value={aigcFilter}
                onChange={(e) => setAigcFilter(e.target.value as AigcFilter)}
              >
                <option value="all">All AIGC Status ({stats.total})</option>
                <option value="none">⚪ No Video ({stats.noVideo})</option>
                <option value="in-progress">🟡 In Progress ({stats.inProgress})</option>
                <option value="published">🟢 Published ({stats.published})</option>
              </select>

              {/* Flag Filter */}
              <select
                className="filter-select text-xs h-9 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-full px-3 text-[var(--text-main)] outline-none"
                value={flagFilter}
                onChange={(e) => setFlagFilter(e.target.value as FlagFilter)}
              >
                <option value="all">All Flags</option>
                <option value="bestseller">⭐ Best Seller</option>
                <option value="new">🆕 New</option>
                <option value="clearance">🏷 Clearance</option>
              </select>

              {/* Availability Filter */}
              <select
                className="filter-select text-xs h-9 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-full px-3 text-[var(--text-main)] outline-none"
                value={availabilityFilter}
                onChange={(e) => setAvailabilityFilter(e.target.value as "active" | "inactive" | "all")}
              >
                <option value="active">Active Catalog</option>
                <option value="all">All Products</option>
                <option value="inactive">Inactive / Removed</option>
              </select>

              {/* Layout Toggle (Grid vs List) */}
              <div className="flex items-center bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-full p-0.5">
                <button
                  type="button"
                  className={`p-1.5 rounded-full transition-colors ${layout === "grid" ? "bg-[var(--castleton)] text-white shadow-sm" : "text-[var(--ink-soft)] hover:text-[var(--text-main)]"}`}
                  onClick={() => setLayout("grid")}
                  title="Grid View"
                >
                  <LayoutGrid size={14} />
                </button>
                <button
                  type="button"
                  className={`p-1.5 rounded-full transition-colors ${layout === "list" ? "bg-[var(--castleton)] text-white shadow-sm" : "text-[var(--ink-soft)] hover:text-[var(--text-main)]"}`}
                  onClick={() => setLayout("list")}
                  title="Table List View"
                >
                  <List size={14} />
                </button>
              </div>

              {/* + Add Product button for Leads */}
              {canEdit && (
                <button
                  type="button"
                  className="btn-primary text-xs h-9 px-3.5 rounded-full flex items-center gap-1.5 font-semibold"
                  onClick={() => {
                    setEditingProduct(null);
                    setFormModalMode("add");
                  }}
                >
                  <Plus size={14} /> Add Product
                </button>
              )}
            </div>
          </div>

          <hr className="border-[var(--glass-border)] m-0" />

          {/* Status Stats Section */}
          <div className="py-.8 flex-shrink-0 flex justify-center bg-[rgba(0,0,0,0.01)] dark:bg-[rgba(255,255,255,0.01)]">
            <div className="catalog-stats-bar" style={{ margin: 0, border: 'none', background: 'transparent' }}>
              <div className="catalog-stat">
                <Package size={16} style={{ color: "var(--castleton)" }} />
                <span className="catalog-stat-num">{stats.total}</span>
                <span className="catalog-stat-label">Products</span>
              </div>
              <div className="catalog-stat-divider" />
              <div className="catalog-stat">
                <Layers size={16} style={{ color: "var(--castleton)" }} />
                <span className="catalog-stat-num">{stats.categories}</span>
                <span className="catalog-stat-label">Categories</span>
              </div>
              <div className="catalog-stat-divider" />
              <div className="catalog-stat">
                <Video size={16} style={{ color: "var(--cat-amber)" }} />
                <span className="catalog-stat-num">{stats.withVideo}</span>
                <span className="catalog-stat-label">With Video</span>
              </div>
              <div className="catalog-stat-divider" />
              <div className="catalog-stat">
                <Star size={16} style={{ color: "#10b981" }} />
                <span className="catalog-stat-num">{stats.published}</span>
                <span className="catalog-stat-label">Published</span>
              </div>
              <div className="catalog-stat-divider" />
              <div className="catalog-stat">
                <span className="catalog-stat-num catalog-coverage-pct">
                  {stats.total > 0 ? Math.round((stats.published / stats.total) * 100) : 0}%
                </span>
                <span className="catalog-stat-label">AIGC Coverage</span>
              </div>
            </div>
          </div>

          <hr className="border-[var(--glass-border)] m-0" />

          {/* Top Pagination Row (Frozen) */}
          {renderPagination("top")}

          {/* Main Grid/List */}
          <div ref={scrollContainerRef} className="flex-1 flex flex-col gap-6 overflow-y-auto custom-scrollbar p-5">
            {/* Active filters chips / Clear */}
            {(search || categoryFilter !== "all" || subcategoryFilter !== "all" || aigcFilter !== "all" || flagFilter !== "all") && (
              <div className="flex items-center gap-2 flex-wrap text-xs flex-shrink-0">
                <span className="text-[var(--ink-soft)] font-medium">Active Filters:</span>
                {categoryFilter !== "all" && (
                  <span className="bg-[var(--glass-bg)] border border-[var(--glass-border)] px-2.5 py-1 rounded-full text-[var(--text-main)] flex items-center gap-1.5">
                    Category: {categoryFilter}
                    <X size={12} className="cursor-pointer hover:text-red-400" onClick={() => setCategoryFilter("all")} />
                  </span>
                )}
                {aigcFilter !== "all" && (
                  <span className="bg-[var(--glass-bg)] border border-[var(--glass-border)] px-2.5 py-1 rounded-full text-[var(--text-main)] flex items-center gap-1.5">
                    Status: {aigcFilter}
                    <X size={12} className="cursor-pointer hover:text-red-400" onClick={() => setAigcFilter("all")} />
                  </span>
                )}
                {flagFilter !== "all" && (
                  <span className="bg-[var(--glass-bg)] border border-[var(--glass-border)] px-2.5 py-1 rounded-full text-[var(--text-main)] flex items-center gap-1.5">
                    Flag: {flagFilter}
                    <X size={12} className="cursor-pointer hover:text-red-400" onClick={() => setFlagFilter("all")} />
                  </span>
                )}
                <button
                  type="button"
                  className="text-red-400 hover:text-red-300 font-medium ml-1 flex items-center gap-1"
                  onClick={() => {
                    setSearch("");
                    setCategoryFilter("all");
                    setSubcategoryFilter("all");
                    setAigcFilter("all");
                    setFlagFilter("all");
                  }}
                >
                  <X size={12} /> Clear All
                </button>
              </div>
            )}

            {/* Error / Loading */}
            {error && (
              <div className="callout" style={{ borderLeft: "4px solid #dc3545", color: "#b02a37", background: "rgba(220,53,69,0.05)" }}>
                ⚠️ {error}
              </div>
            )}

            {loading ? (
              <div className="flex justify-center p-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--castleton)]"></div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-16 panel border-dashed">
                <Package className="h-12 w-12 text-[var(--ink-soft)] opacity-40 mb-4" />
                <h3 className="text-base font-semibold text-[var(--text-main)]">No products match your filters</h3>
                <p className="text-xs text-[var(--ink-soft)] mt-1.5">Try clearing or adjusting your search criteria.</p>
              </div>
            ) : layout === "grid" ? (
              /* Grid view */
              <ProductGrid
                products={gridProducts}
                onCardClick={(p) => p.rawCatalogProduct && setDetailProduct(p.rawCatalogProduct)}
                onEdit={(p) => {
                  if (p.rawCatalogProduct) {
                    setEditingProduct(p.rawCatalogProduct);
                    setFormModalMode("edit");
                  }
                }}
                onToggleActive={handleToggleActive}
                onViewInLibrary={() => onNavigateToLibrary()}
                canEdit={canEdit}
              />
            ) : (
              /* List view */
              <div className="flex flex-col w-full shrink-0 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl overflow-hidden shadow-sm">
                <div className="flex items-center gap-4 px-5 py-2 text-[10px] font-bold text-[var(--ink-soft)] uppercase tracking-wider border-b border-[var(--glass-border)] bg-[rgba(0,0,0,0.02)] dark:bg-[rgba(255,255,255,0.02)]">
                  <span style={{ flex: 3 }}>Product</span>
                  <span style={{ flex: 2 }}>Category</span>
                  <span style={{ flex: 1, textAlign: "center" }}>Variants</span>
                  <span style={{ flex: 1, textAlign: "center" }}>AIGC Status</span>
                  <span style={{ flex: 1, textAlign: "right" }}>Actions</span>
                </div>
                {paginatedFiltered.map((cp) => {
                  const pData = gridProducts.find(p => p.id === cp.id)!;
                  return (
                    <CatalogListRow
                      key={cp.id}
                      product={cp}
                      aigcStatus={pData.aigcStatus!}
                      linkedProduct={getLinkedProduct(cp.id, products)}
                      videosInProduction={pData.videosInProduction}
                      isActive={pData.isActive}
                      canEdit={canEdit}
                      onView={() => setDetailProduct(cp)}
                      onEdit={() => { setEditingProduct(cp); setFormModalMode("edit"); }}
                      onToggleActive={(e) => handleToggleActive(pData, e)}
                      onNavigateToLibrary={onNavigateToLibrary}
                    />
                  );
                })}
              </div>
            )}

          </div>
        </div>
      </div>
      {/* ── Modals ── */}
      {detailProduct && (
        <CatalogDetailModal
          product={detailProduct}
          aigcStatus={getAigcStatus(detailProduct.id, products)}
          linkedProduct={getLinkedProduct(detailProduct.id, products)}
          canEdit={canEdit}
          onClose={() => setDetailProduct(null)}
          onEdit={() => { setEditingProduct(detailProduct); setFormModalMode("edit"); setDetailProduct(null); }}
          onNavigateToLibrary={onNavigateToLibrary}
        />
      )}
      {formModalMode && (
        <CatalogProductFormModal
          mode={formModalMode}
          product={editingProduct}
          onClose={() => { setFormModalMode(null); setEditingProduct(null); }}
        />
      )}
    </div>
  );
}

// ─── List Row ───────────────────────────────────────────────────────────────

interface CardProps {
  product: CatalogProduct;
  aigcStatus: AigcStatus;
  linkedProduct: Product | null;
  videosInProduction?: number;
  isActive?: boolean;
  canEdit: boolean;
  onView: () => void;
  onEdit: () => void;
  onToggleActive?: (e: React.MouseEvent) => void;
  onNavigateToLibrary: () => void;
}

function CatalogListRow({ product, aigcStatus, linkedProduct, videosInProduction, isActive, canEdit, onView, onEdit, onToggleActive, onNavigateToLibrary }: CardProps) {
  const badge = AIGC_BADGE[aigcStatus];
  const stageLabel = linkedProduct?.items?.[0]?.status || badge.label;

  return (
    <div className="flex items-center gap-4 px-5 py-1.5 border-b border-[var(--glass-border)] hover:bg-[var(--glass-hover)] transition-colors cursor-pointer group last:border-b-0" onClick={onView} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onView()}>
      <div style={{ flex: 3 }} className="flex items-center gap-3 overflow-hidden">
        <div className="w-8 h-8 rounded-lg bg-[var(--glass-bg)] border border-[var(--glass-border)] flex items-center justify-center shrink-0 overflow-hidden">
          {product.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.thumbnailUrl} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <Package size={14} className="text-[var(--ink-soft)] opacity-50" />
          )}
        </div>
        <div className="min-w-0 flex flex-col justify-center">
          <div className="text-sm font-bold text-[var(--text-main)] truncate leading-tight">{product.name}</div>
          {product.price && <div className="text-xs font-semibold text-[var(--castleton)] mt-0.5 leading-tight">{product.price}</div>}
        </div>
      </div>
      <div style={{ flex: 2 }} className="min-w-0 flex flex-col justify-center">
        <div className="text-xs font-semibold text-[var(--text-main)] truncate leading-tight">{product.category}</div>
        <div className="text-[10px] font-medium text-[var(--ink-soft)] truncate mt-0.5 leading-tight">{product.subcategory}</div>
      </div>
      <div style={{ flex: 1 }} className="flex justify-center">
        <span className="text-xs font-bold px-2 py-0.5 rounded bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-main)]">{product.variantCount}</span>
      </div>
      <div style={{ flex: 1 }} className="flex justify-center">
        {aigcStatus !== "none" ? (
          <div className="flex flex-col items-center gap-1">
            <span className={`catalog-aigc-badge ${badge.cls} text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full shadow-sm`}>{stageLabel}</span>
            {videosInProduction !== undefined && videosInProduction > 0 && (
              <span className="text-[9px] font-semibold text-[var(--ink-soft)] uppercase flex items-center gap-0.5" title={`${videosInProduction} video(s) in production`}>
                <Video size={10} /> {videosInProduction} Prod
              </span>
            )}
          </div>
        ) : (
          <span className="text-[var(--ink-soft)] opacity-50 font-bold">—</span>
        )}
      </div>
      <div style={{ flex: 1 }} className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
        {canEdit && (
          <button
            type="button"
            onClick={onToggleActive}
            className={`relative w-8 h-4 rounded-full transition-colors border shadow-sm flex items-center shrink-0 my-auto ${isActive ? "bg-[var(--castleton)] border-[var(--castleton)]" : "bg-[var(--glass-bg)] border-[var(--glass-border)]"}`}
            title={isActive ? "Active in Catalog" : "Hidden (Inactive)"}
          >
            <span className={`absolute left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${isActive ? "translate-x-3.5" : "translate-x-0"}`} />
          </button>
        )}
        {aigcStatus !== "none" && (
          <button className="w-7 h-7 rounded-full bg-[var(--glass-bg)] hover:bg-[var(--glass-hover)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--ink-soft)] hover:text-[var(--castleton)] transition-all" onClick={onNavigateToLibrary} title="View in Library">
            <ChevronRight size={14} />
          </button>
        )}
        {canEdit && (
          <button className="w-7 h-7 rounded-full bg-[var(--glass-bg)] hover:bg-[var(--glass-hover)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--ink-soft)] hover:text-[var(--text-main)] transition-all" onClick={onEdit} title="Edit">
            <Edit2 size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Detail Modal ───────────────────────────────────────────────────────────

interface ModalProps {
  product: CatalogProduct;
  aigcStatus: AigcStatus;
  linkedProduct: Product | null;
  canEdit: boolean;
  onClose: () => void;
  onEdit: () => void;
  onNavigateToLibrary: () => void;
}

function CatalogDetailModal({ product, aigcStatus, linkedProduct, canEdit, onClose, onEdit, onNavigateToLibrary }: ModalProps) {
  const mounted = useMounted();
  const badge = AIGC_BADGE[aigcStatus];
  const stageLabel = linkedProduct?.items?.[0]?.status || badge.label;

  if (!mounted) return null;

  const modal = (
    <div className="overlay show modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal modal-panel overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 900, width: "100%", maxHeight: "90vh", display: "flex", flexDirection: "column", padding: 0 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--glass-border)] bg-[var(--glass-bg)] z-10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[var(--glass-hover)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--castleton)]">
              <Package size={14} />
            </div>
            <div>
              <div className="text-[10px] font-bold text-[var(--ink-soft)] uppercase tracking-wider leading-none mb-1">Product Details</div>
              <h2 className="text-sm font-extrabold text-[var(--text-main)] leading-none truncate max-w-sm">{product.name}</h2>
            </div>
          </div>
          <button className="w-8 h-8 rounded-full bg-[var(--glass-hover)] hover:bg-[var(--glass-border)] flex items-center justify-center text-[var(--ink-soft)] hover:text-[var(--text-main)] transition-all" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 flex flex-col sm:flex-row overflow-hidden bg-[var(--glass-bg)]">
          {/* Left Column: Image Area */}
          <div className="w-full sm:w-[400px] border-b sm:border-b-0 sm:border-r border-[var(--glass-border)] flex flex-col shrink-0 relative bg-black/5 dark:bg-black/20 overflow-hidden group">
            {product.thumbnailUrl ? (
              <div className="absolute inset-0 w-full h-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={product.thumbnailUrl} alt={product.name} className="w-full h-full object-contain p-6 drop-shadow-2xl transition-transform duration-500 group-hover:scale-105" referrerPolicy="no-referrer" />
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-[var(--ink-soft)]">
                <Package size={48} className="opacity-20" />
              </div>
            )}

            {aigcStatus !== 'none' && (
              <div className="absolute top-4 left-4 z-10">
                <span className={`catalog-aigc-badge ${badge.cls} text-[10px] font-bold uppercase tracking-wide px-3 py-1.5 rounded-full shadow-lg backdrop-blur-md border border-white/20`}>
                  {stageLabel}
                </span>
              </div>
            )}
          </div>

          {/* Right Column: Details */}
          <div className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
            
            {/* AIGC Production status */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5">
                <div className="text-[10px] font-bold text-[var(--ink-soft)] uppercase tracking-wider">AIGC Video Status</div>
                <span title="Indicates the current stage of this product's video in the AIGC generation pipeline.">
                  <Info size={12} className="text-[var(--ink-soft)] cursor-help" />
                </span>
              </div>
              <div className={`catalog-aigc-card ${badge.cls} p-3 rounded-lg border flex flex-col gap-2`}>
                <span className="text-[10px] font-bold uppercase tracking-wider">{badge.label}</span>
                {linkedProduct ? (
                  <div className="flex flex-col gap-1 text-xs text-[var(--ink)]">
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--ink-soft)]">Stage</span>
                      <span className="font-semibold text-[var(--text-main)]">{linkedProduct.items[0]?.status ?? "—"}</span>
                    </div>
                    {linkedProduct.reviewStatus && (
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--ink-soft)]">Review</span>
                        <span className="font-semibold text-[var(--text-main)]">{linkedProduct.reviewStatus}</span>
                      </div>
                    )}
                    {linkedProduct.owner && (
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--ink-soft)]">Operator</span>
                        <span className="font-semibold text-[var(--text-main)]">{linkedProduct.owner}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--ink-soft)] m-0">
                    No AIGC video has been requested for this product yet.
                  </p>
                )}
              </div>
            </div>

            {/* Meta */}
            <div className="flex flex-col gap-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="flex flex-col gap-0.5 p-3 rounded-lg bg-[var(--glass-bg)] border border-[var(--glass-border)]">
                  <label className="text-[10px] font-bold text-[var(--castleton)] uppercase tracking-wider">Category</label>
                  <span className="text-sm font-semibold text-[var(--text-main)]">{product.category}</span>
                </div>
                <div className="flex flex-col gap-0.5 p-3 rounded-lg bg-[var(--glass-bg)] border border-[var(--glass-border)]">
                  <label className="text-[10px] font-bold text-[var(--castleton)] uppercase tracking-wider">Subcategory</label>
                  <span className="text-sm font-semibold text-[var(--text-main)]">{product.subcategory}</span>
                </div>
              </div>
              {product.price && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--glass-bg)] border border-[var(--glass-border)] text-sm font-semibold">
                  <span className="text-[var(--ink-soft)] text-xs">Price</span>
                  <span className="text-[var(--text-main)]">{product.price}</span>
                </div>
              )}
              {product.flagStatus && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--glass-bg)] border border-[var(--glass-border)] text-sm font-semibold">
                  <span className="text-[var(--ink-soft)] text-xs">Status</span>
                  <span className="text-[var(--saffron)]">{product.flagStatus}</span>
                </div>
              )}
              {product.productUrl && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--glass-bg)] border border-[var(--glass-border)] text-sm font-semibold">
                  <span className="text-[var(--ink-soft)] text-xs">Link</span>
                  <a
                    href={product.productUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[var(--castleton)] hover:text-[#10b981] font-bold transition-colors text-xs"
                  >
                    Visit page <ExternalLink size={12} />
                  </a>
                </div>
              )}
            </div>

            {/* Variants */}
            {product.variants.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="text-[10px] font-bold text-[var(--ink-soft)] uppercase tracking-wider">
                  Variants ({product.variantCount})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {product.variants.map((v) => (
                    <span key={v} className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[var(--glass-hover)] border border-[var(--glass-border)] text-[var(--text-main)]">{v}</span>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--glass-border)] flex-shrink-0 bg-[var(--glass-bg)] z-10">
          {canEdit && (
            <button className="btn-ghost px-4 py-2 rounded-full font-bold text-xs bg-[var(--glass-hover)] text-[var(--ink-soft)] hover:text-[var(--text-main)] flex items-center gap-1.5 transition-all border border-[var(--glass-border)]" onClick={onEdit}>
              <Edit2 size={12} /> Edit Product
            </button>
          )}
          {aigcStatus !== "none" && (
            <button className="btn-primary px-5 py-2 rounded-full font-bold text-xs bg-[var(--castleton)] text-white flex items-center gap-1.5 hover:bg-[#08754e] transition-all shadow-md" onClick={onNavigateToLibrary}>
              View in Library <ChevronRight size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
