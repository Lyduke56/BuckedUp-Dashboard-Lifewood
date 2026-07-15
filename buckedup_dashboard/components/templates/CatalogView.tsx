"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
  Search, Plus, ExternalLink, ChevronRight, X, Edit2,
  Video, Package, LayoutGrid, List, Star, Tag, Layers,
} from "lucide-react";
import { CatalogLayout } from "@/components/templates/CatalogLayout";
import { SearchBar } from "@/components/molecules/SearchBar";
import { FilterSidebar } from "@/components/organisms/FilterSidebar";
import { ProductGrid } from "@/components/organisms/ProductGrid";
import type { ProductData } from "@/components/organisms/ProductCard";
import { PageHeader } from "@/components/molecules/PageHeader";
import { CATEGORY_TREE } from "@/lib/data";
import { CatalogProductFormModal } from "@/components/organisms/CatalogProductFormModal";
import { useAuth } from "@/lib/useAuth";
import type { AigcStatus, CatalogProduct, Product } from "@/lib/types";

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
  none:        { label: "No Video",    cls: "aigc-none" },
  "in-progress": { label: "In Progress", cls: "aigc-progress" },
  published:   { label: "Published",   cls: "aigc-published" },
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
}

export function CatalogView({
  catalog,
  products,
  loading,
  error,
  onNavigateToLibrary,
}: CatalogViewProps) {
  const { role } = useAuth();
  const isLead = role === "lead";

  // ── Filter state ──
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [subcategoryFilter, setSubcategoryFilter] = useState("all");
  const [aigcFilter, setAigcFilter] = useState<AigcFilter>("all");
  const [flagFilter, setFlagFilter] = useState<FlagFilter>("all");
  const [layout, setLayout] = useState<LayoutMode>("grid");

  // ── Modal state ──
  const [formModalMode, setFormModalMode] = useState<"add" | "edit" | null>(null);
  const [editingProduct, setEditingProduct] = useState<CatalogProduct | null>(null);
  const [detailProduct, setDetailProduct] = useState<CatalogProduct | null>(null);

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
      return true;
    });
  }, [catalog, search, categoryFilter, subcategoryFilter, aigcFilter, flagFilter, products]);

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
    return filtered.map((cp) => {
      const status = getAigcStatus(cp.id, products);
      return {
        id: cp.id,
        category: cp.category,
        subcategory: cp.subcategory,
        name: cp.name,
        variants: (cp.variants ?? []).join(", "),
        variantCount: String(cp.variantCount ?? (cp.variants ?? []).length),
        price: cp.price ?? "",
        flag: cp.flagStatus ?? "",
        link: cp.productUrl ?? "",
        aigcStatus: status,
        rawCatalogProduct: cp,
      };
    });
  }, [filtered, products]);

  // ── Sidebar section ──
  const sidebar = (
    <FilterSidebar
      categories={sidebarCategories}
      selectedCategories={categoryFilter === "all" ? [] : [categoryFilter]}
      onCategoryChange={(cat: string) => {
        setCategoryFilter((prev) => (prev === cat ? "all" : cat));
        setSubcategoryFilter("all");
      }}
    />
  );

  // ── Header section ──
  const header = (
    <div className="panel p-4 flex flex-col sm:flex-row gap-4 items-center justify-between">
      <div className="flex-1 w-full max-w-md">
        <SearchBar
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          className="bg-[var(--glass-bg)] border-[var(--glass-border)]"
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

        {/* Layout Toggle (Grid vs List) */}
        <div className="flex items-center bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-full p-0.5">
          <button
            type="button"
            className={`p-1.5 rounded-full transition-colors ${layout === "grid" ? "bg-[var(--castleton)] text-white shadow-sm" : "text-[var(--ink-soft)] hover:text-white"}`}
            onClick={() => setLayout("grid")}
            title="Grid View"
          >
            <LayoutGrid size={14} />
          </button>
          <button
            type="button"
            className={`p-1.5 rounded-full transition-colors ${layout === "list" ? "bg-[var(--castleton)] text-white shadow-sm" : "text-[var(--ink-soft)] hover:text-white"}`}
            onClick={() => setLayout("list")}
            title="Table List View"
          >
            <List size={14} />
          </button>
        </div>

        {/* + Add Product button for Leads */}
        {isLead && (
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

        <div className="text-xs font-medium text-[var(--ink-soft)] whitespace-nowrap hidden lg:block ml-1">
          Showing <strong className="text-[var(--text-main)]">{filtered.length}</strong> of {catalog.length}
        </div>
      </div>
    </div>
  );

  // ── Content section ──
  const content = (
    <div className="flex flex-col gap-6">
      {/* ── Stats bar ── */}
      <div className="catalog-stats-bar">
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

      {/* ── Active filter chips / Clear ── */}
      {(search || categoryFilter !== "all" || subcategoryFilter !== "all" || aigcFilter !== "all" || flagFilter !== "all") && (
        <div className="flex items-center gap-2 flex-wrap text-xs">
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

      {/* ── Error / Loading ── */}
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
        /* ── Grid view using ProductGrid & ProductCard ── */
        <ProductGrid
          products={gridProducts}
          onCardClick={(p) => p.rawCatalogProduct && setDetailProduct(p.rawCatalogProduct)}
          onEdit={(p) => {
            if (p.rawCatalogProduct) {
              setEditingProduct(p.rawCatalogProduct);
              setFormModalMode("edit");
            }
          }}
          onViewInLibrary={() => onNavigateToLibrary()}
          isLead={isLead}
        />
      ) : (
        /* ── List view ── */
        <div className="catalog-list">
          <div className="catalog-list-header">
            <span style={{ flex: 3 }}>Product</span>
            <span style={{ flex: 2 }}>Category</span>
            <span style={{ flex: 1, textAlign: "center" }}>Variants</span>
            <span style={{ flex: 1, textAlign: "center" }}>AIGC</span>
            <span style={{ flex: 1, textAlign: "right" }}>Actions</span>
          </div>
          {filtered.map((cp) => (
            <CatalogListRow
              key={cp.id}
              product={cp}
              aigcStatus={getAigcStatus(cp.id, products)}
              linkedProduct={getLinkedProduct(cp.id, products)}
              isLead={isLead}
              onView={() => setDetailProduct(cp)}
              onEdit={() => { setEditingProduct(cp); setFormModalMode("edit"); }}
              onNavigateToLibrary={onNavigateToLibrary}
            />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <>
      <CatalogLayout
        sidebar={sidebar}
        header={header}
        content={content}
      />

      {/* ── Detail drawer ── */}
      {detailProduct && (
        <CatalogDetailDrawer
          product={detailProduct}
          aigcStatus={getAigcStatus(detailProduct.id, products)}
          linkedProduct={getLinkedProduct(detailProduct.id, products)}
          isLead={isLead}
          onClose={() => setDetailProduct(null)}
          onEdit={() => { setEditingProduct(detailProduct); setFormModalMode("edit"); setDetailProduct(null); }}
          onNavigateToLibrary={onNavigateToLibrary}
        />
      )}

      {/* ── Modals ── */}
      {formModalMode && (
        <CatalogProductFormModal
          mode={formModalMode}
          product={editingProduct}
          onClose={() => { setFormModalMode(null); setEditingProduct(null); }}
        />
      )}
    </>
  );
}

// ─── List Row ───────────────────────────────────────────────────────────────

interface CardProps {
  product: CatalogProduct;
  aigcStatus: AigcStatus;
  linkedProduct: Product | null;
  isLead: boolean;
  onView: () => void;
  onEdit: () => void;
  onNavigateToLibrary: () => void;
}

function CatalogListRow({ product, aigcStatus, linkedProduct, isLead, onView, onEdit, onNavigateToLibrary }: CardProps) {
  const badge = AIGC_BADGE[aigcStatus];

  return (
    <div className="catalog-list-row" onClick={onView} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onView()}>
      <div style={{ flex: 3, display: "flex", alignItems: "center", gap: 10 }}>
        <div className="catalog-list-thumb">
          {product.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.thumbnailUrl} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 4 }} />
          ) : (
            <Package size={14} style={{ opacity: 0.3 }} />
          )}
        </div>
        <div>
          <div className="catalog-list-name">{product.name}</div>
          {product.price && <div className="catalog-list-price">{product.price}</div>}
        </div>
      </div>
      <div style={{ flex: 2 }}>
        <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>{product.category}</div>
        <div style={{ fontSize: 11, color: "var(--ink-soft)", opacity: 0.7 }}>{product.subcategory}</div>
      </div>
      <div style={{ flex: 1, textAlign: "center" }}>
        <span className="catalog-variant-count">{product.variantCount}</span>
      </div>
      <div style={{ flex: 1, textAlign: "center" }}>
        <span className={`catalog-aigc-badge ${badge.cls}`}>{badge.label}</span>
      </div>
      <div style={{ flex: 1, textAlign: "right", display: "flex", gap: 6, justifyContent: "flex-end" }} onClick={(e) => e.stopPropagation()}>
        {aigcStatus !== "none" && (
          <button className="btn-ghost-sm" onClick={onNavigateToLibrary}>
            <ChevronRight size={11} />
          </button>
        )}
        {isLead && (
          <button className="btn-ghost-icon" onClick={onEdit} title="Edit">
            <Edit2 size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Detail Drawer ──────────────────────────────────────────────────────────

interface DrawerProps {
  product: CatalogProduct;
  aigcStatus: AigcStatus;
  linkedProduct: Product | null;
  isLead: boolean;
  onClose: () => void;
  onEdit: () => void;
  onNavigateToLibrary: () => void;
}

function CatalogDetailDrawer({ product, aigcStatus, linkedProduct, isLead, onClose, onEdit, onNavigateToLibrary }: DrawerProps) {
  const badge = AIGC_BADGE[aigcStatus];

  return (
    <>
      {/* Backdrop */}
      <div className="drawer-backdrop fixed inset-0 z-[9998] bg-black/75 backdrop-blur-md animate-fadeIn" onClick={onClose} />

      {/* Drawer panel */}
      <div className="catalog-drawer fixed top-0 right-0 bottom-0 z-[9999] w-full max-w-[440px] bg-[#0e1512]/96 border-l border-white/10 shadow-2xl backdrop-blur-2xl flex flex-col overflow-hidden animate-slideLeft">
        <div className="catalog-drawer-header flex items-start justify-between p-6 border-b border-white/10 bg-white/[0.02] gap-4 flex-shrink-0">
          <div className="min-w-0 flex-1">
            <div className="modal-overline text-xs font-bold text-[var(--castleton)] uppercase tracking-wider mb-1">CATALOG DETAIL</div>
            <h2 className="catalog-drawer-title text-lg font-extrabold text-white leading-snug break-words">{product.name}</h2>
          </div>
          <button className="modal-close-btn w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-[var(--ink-soft)] hover:text-white transition-all flex-shrink-0" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="catalog-drawer-body p-6 overflow-y-auto flex-1 flex flex-col gap-6">
          {/* Thumb */}
          <div className="catalog-drawer-thumb w-full h-56 rounded-2xl bg-black/40 border border-white/10 overflow-hidden relative flex items-center justify-center">
            {product.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.thumbnailUrl} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div className="flex items-center justify-center h-full text-[var(--ink-soft)]">
                <Package size={36} className="opacity-30" />
              </div>
            )}
            <span className={`catalog-aigc-badge ${badge.cls} absolute top-3 right-3 text-xs font-bold uppercase tracking-wide px-3 py-1 rounded-full shadow-md backdrop-blur-md`}>
              {badge.label}
            </span>
          </div>

          {/* Meta */}
          <div className="catalog-drawer-meta flex flex-col gap-3">
            <div className="catalog-drawer-field flex flex-col gap-1 p-3.5 rounded-xl bg-white/[0.03] border border-white/5">
              <label className="text-[11px] font-bold text-[var(--castleton)] uppercase tracking-wider">Category</label>
              <span className="text-sm font-semibold text-white">{product.category}</span>
            </div>
            <div className="catalog-drawer-field flex flex-col gap-1 p-3.5 rounded-xl bg-white/[0.03] border border-white/5">
              <label className="text-[11px] font-bold text-[var(--castleton)] uppercase tracking-wider">Subcategory</label>
              <span className="text-sm font-semibold text-white">{product.subcategory}</span>
            </div>
            {product.price && (
              <div className="catalog-drawer-meta-row flex items-center justify-between p-3.5 rounded-xl bg-white/[0.02] border border-white/5 text-sm font-semibold">
                <span className="catalog-drawer-label text-[var(--ink-soft)]">Price</span>
                <span className="text-white">{product.price}</span>
              </div>
            )}
            {product.flagStatus && (
              <div className="catalog-drawer-meta-row flex items-center justify-between p-3.5 rounded-xl bg-white/[0.02] border border-white/5 text-sm font-semibold">
                <span className="catalog-drawer-label text-[var(--ink-soft)]">Status</span>
                <span className="text-[var(--saffron)]">{product.flagStatus}</span>
              </div>
            )}
            {product.productUrl && (
              <div className="catalog-drawer-meta-row flex items-center justify-between p-3.5 rounded-xl bg-white/[0.02] border border-white/5 text-sm font-semibold">
                <span className="catalog-drawer-label text-[var(--ink-soft)]">Product Page</span>
                <a
                  href={product.productUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="catalog-drawer-link inline-flex items-center gap-1.5 text-[var(--castleton)] hover:text-[#10b981] font-bold transition-colors"
                >
                  Visit page <ExternalLink size={12} />
                </a>
              </div>
            )}
          </div>

          {/* Variants */}
          {product.variants.length > 0 && (
            <div className="catalog-drawer-section flex flex-col gap-3">
              <div className="catalog-drawer-section-title text-xs font-bold text-[var(--ink-soft)] uppercase tracking-wider">
                Variants ({product.variantCount})
              </div>
              <div className="catalog-drawer-variants flex flex-wrap gap-2">
                {product.variants.map((v) => (
                  <span key={v} className="variant-chip-sm text-xs font-semibold px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[var(--ink-soft)]">{v}</span>
                ))}
              </div>
            </div>
          )}

          {/* AIGC Production status */}
          <div className="catalog-drawer-section flex flex-col gap-3">
            <div className="catalog-drawer-section-title text-xs font-bold text-[var(--ink-soft)] uppercase tracking-wider">AIGC Video Status</div>
            <div className={`catalog-aigc-card ${badge.cls} p-4 rounded-xl border flex flex-col gap-2.5`}>
              <span className="catalog-aigc-card-badge text-xs font-bold uppercase tracking-wider">{badge.label}</span>
              {linkedProduct ? (
                <div className="catalog-aigc-card-details flex flex-col gap-1.5 text-sm text-[var(--ink)]">
                  <div className="flex justify-between items-center">
                    <span className="catalog-drawer-label text-[var(--ink-soft)]">Stage</span>
                    <span className="font-semibold text-white">{linkedProduct.items[0]?.status ?? "—"}</span>
                  </div>
                  {linkedProduct.reviewStatus && (
                    <div className="flex justify-between items-center">
                      <span className="catalog-drawer-label text-[var(--ink-soft)]">Review</span>
                      <span className="font-semibold text-white">{linkedProduct.reviewStatus}</span>
                    </div>
                  )}
                  {linkedProduct.owner && (
                    <div className="flex justify-between items-center">
                      <span className="catalog-drawer-label text-[var(--ink-soft)]">Operator</span>
                      <span className="font-semibold text-white">{linkedProduct.owner}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-[var(--ink-soft)] m-0">
                  No AIGC video has been requested for this product yet.
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="catalog-drawer-actions flex items-center justify-end gap-3 mt-auto pt-4 border-t border-white/10 flex-shrink-0">
            {aigcStatus !== "none" && (
              <button className="btn-primary px-4 py-2.5 rounded-xl font-bold text-sm bg-[var(--castleton)] text-white flex items-center gap-2 hover:bg-[#08754e] transition-all" onClick={onNavigateToLibrary}>
                <ChevronRight size={14} /> View in Library
              </button>
            )}
            {isLead && (
              <button className="btn-ghost px-4 py-2.5 rounded-xl font-bold text-sm bg-white/5 border border-white/10 text-[var(--ink-soft)] hover:text-white flex items-center gap-2 transition-all" onClick={onEdit}>
                <Edit2 size={14} /> Edit Product
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
