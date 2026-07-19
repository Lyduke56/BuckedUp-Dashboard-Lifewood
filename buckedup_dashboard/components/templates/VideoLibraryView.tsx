"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { List, LayoutGrid, Kanban } from "lucide-react";
import { PageHeader } from "@/components/molecules/PageHeader";
import { CATEGORY_TREE, STATUS_CLASS, STATUS_ORDER, reviewStatusClass } from "@/lib/data";
import {
  DELIVERABLE_STAGES,
  type Issue,
  type IssueSeverity,
  type PipelineStatus,
  type Product,
  type StatusFilter,
  type StageDeliverable,
} from "@/lib/types";
import {
  categoryCountProducts,
  getModalKey,
  productBucket,
  productProgressPct,
  subcategoryCountProducts,
} from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useIssues } from "@/lib/useIssues";
import { useAuth } from "@/lib/useAuth";
import { useProfiles } from "@/lib/useProfiles";
import { KanbanBoard } from "@/components/organisms/KanbanBoard";
import { CategoryFolderGrid } from "@/components/molecules/CategoryFolderGrid";
import { ProductThumbnailGrid } from "@/components/molecules/ProductThumbnailGrid";
import { ProductFormModal } from "@/components/organisms/ProductFormModal";
import { RequestVideoModal } from "@/components/organisms/RequestVideoModal";
import { ProductionModal } from "@/components/organisms/ProductionModal";
import { ProductReviewModal } from "@/components/organisms/ProductReviewModal";
import { StageHistoryLog } from "@/components/organisms/StageHistoryLog";

// Stages an Operator can submit a deliverable for (Design and Production).
// A Lead reviews in Design and In Review stages.
const OPERATOR_SUBMIT_STAGES = ["Design", "Production"] as string[];
const LEAD_REVIEW_STAGES = ["Design", "In Review"] as string[];

type LibraryLayout = "table" | "board" | "grid";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All Stages" },
  { value: "not-started", label: "Not started" },
  { value: "in-progress", label: "In progress" },
  { value: "published", label: "Published" },
];

const LANGUAGE_FLAG: Record<string, string> = {
  English: "🇺🇸",
  Spanish: "🇪🇸",
};

function languageFlag(language: string): string {
  return LANGUAGE_FLAG[language] ?? "🌐";
}

export type LibraryProductFocus = { product: Product; source: "review" | "production" | "edit" };

interface VideoLibraryViewProps {
  onOpenModal: (key: string) => void;
  products: Product[];
  currentByKey: Map<string, StageDeliverable>;
  loading: boolean;
  error: string | null;
  externalSearch?: string | null;
  onExternalSearchApplied?: () => void;
  externalReviewRank?: number | null;
  onExternalReviewRankApplied?: () => void;
  theme: "dark" | "light";
  onProductFocus?: (focus: LibraryProductFocus | null) => void;
}

export function VideoLibraryView({
  onOpenModal,
  products,
  currentByKey,
  loading,
  error,
  externalSearch,
  onExternalSearchApplied,
  externalReviewRank,
  onExternalReviewRankApplied,
  theme,
  onProductFocus,
}: VideoLibraryViewProps) {
  const [currentCategory, setCurrentCategory] = useState("all");
  const [currentSubcategory, setCurrentSubcategory] = useState("all");
  const [currentStatusFilter, setCurrentStatusFilter] =
    useState<StatusFilter>("all");
  const [mineOnly, setMineOnly] = useState(false);
  const [rejectedOnly, setRejectedOnly] = useState(false);
  const [currentSort, setCurrentSort] = useState<"highest" | "lowest" | "oldest">("highest");
  const [searchTerm, setSearchTerm] = useState("");
  const [layout, setLayout] = useState<LibraryLayout>("table");
  // Which category folder is open in Grid view (null = show the folders).
  const [gridFolder, setGridFolder] = useState<string | null>(null);

  // Adjusted during render (React's sanctioned pattern for syncing local
  // state from a prop) rather than an effect, since this is the component's
  // own state, not a side effect on an external system.
  const [appliedExternalSearch, setAppliedExternalSearch] = useState<
    string | null | undefined
  >(undefined);
  if (externalSearch && externalSearch !== appliedExternalSearch) {
    setAppliedExternalSearch(externalSearch);
    setSearchTerm(externalSearch);
    setCurrentCategory("all");
    setCurrentSubcategory("all");
    setCurrentStatusFilter("all");
    setMineOnly(false);
    setRejectedOnly(false);
  }

  // This one's a real effect: telling the parent "consumed" is a side
  // effect on an external system, not this component's own state.
  useEffect(() => {
    if (externalSearch) onExternalSearchApplied?.();
  }, [externalSearch, onExternalSearchApplied]);

  // (Moved below state declarations)

  const [expandedRanks, setExpandedRanks] = useState<Set<number>>(new Set());
  const [formModal, setFormModal] = useState<{
    mode: "add" | "edit";
    product: Product | null;
  } | null>(null);
  const [requestCatalogModalOpen, setRequestCatalogModalOpen] = useState(false);
  const [productionModal, setProductionModal] = useState<Product | null>(null);
  const [reviewModal, setReviewModal] = useState<Product | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Same pattern for jumping straight into a review modal from the Reviews tab.
  const [appliedReviewRank, setAppliedReviewRank] = useState<number | null | undefined>(undefined);
  
  if (externalReviewRank !== undefined && externalReviewRank !== appliedReviewRank) {
    setAppliedReviewRank(externalReviewRank);
    if (externalReviewRank !== null) {
      const product = products.find(p => p.rank === externalReviewRank);
      if (product) {
        setReviewModal(product);
      }
    }
  }

  useEffect(() => {
    if (externalReviewRank !== undefined && externalReviewRank !== null) {
      onExternalReviewRankApplied?.();
    }
  }, [externalReviewRank, onExternalReviewRankApplied]);

  // Reports which product (if any) is currently being worked on — via the
  // review, production, or edit-form modal — up to Dashboard for Bucky's
  // context awareness. Same "real effect" reasoning as the
  // externalSearch/onExternalSearchApplied pair above: telling the parent
  // is a side effect on an external system, not this component's own
  // state. At most one of these three is ever open at a time in this UI,
  // but the priority order (review > production > edit) resolves any
  // theoretical overlap deterministically.
  useEffect(() => {
    if (reviewModal) {
      onProductFocus?.({ product: reviewModal, source: "review" });
    } else if (productionModal) {
      onProductFocus?.({ product: productionModal, source: "production" });
    } else if (formModal?.mode === "edit" && formModal.product) {
      onProductFocus?.({ product: formModal.product, source: "edit" });
    } else {
      onProductFocus?.(null);
    }
  }, [reviewModal, productionModal, formModal, onProductFocus]);

  const { issues, reportIssue, resolveIssue } = useIssues();
  const { user, role } = useAuth();
  const { profiles } = useProfiles();
  const isAuthenticated = !!user;

  // Default "My Items" to ON for operators so they see their own work first.
  const mineOnlyInitRef = useRef(false);
  useEffect(() => {
    if (role === "operator" && !mineOnlyInitRef.current) {
      mineOnlyInitRef.current = true;
      setMineOnly(true);
    }
  }, [role]);
  // Lead and Admin: full catalog access (add/edit/delete products, move
  // stage via ProductFormModal's Stage field) plus reviewing submitted
  // deliverables. Admin has identical library powers to Lead — the sole
  // difference is Admin also manages user accounts (Lead cannot).
  // Operator: execution-only — submits the deliverable for the current
  // stage, never moves the stage itself. See supabase/schema.sql's
  // enforce_product_update_permissions() for the DB-level version of
  // this same split — this is UI convenience, not the security boundary.
  const canManageCatalog = role === "lead" || role === "admin";
  // Admin now has full library access (same as Lead), so no special
  // restrictions or filtered views apply — isAdmin is unused.
  const isAdmin = false;
  const nextRank =
    products.length === 0 ? 1 : Math.max(...products.map((p) => p.rank)) + 1;
  const profileEmailById = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile.email])),
    [profiles],
  );

  const filteredProducts = useMemo(() => {
    const query = searchTerm.toLowerCase();
    const filtered = products.filter((product) => {
      // Admin only ever sees Published items, regardless of the pills.
      if (isAdmin && productBucket(product) !== "published") {
        return false;
      }
      if (currentCategory !== "all" && product.category !== currentCategory) {
        return false;
      }
      if (
        currentSubcategory !== "all" &&
        product.subcategory !== currentSubcategory
      ) {
        return false;
      }
      if (
        currentStatusFilter !== "all" &&
        productBucket(product) !== currentStatusFilter
      ) {
        return false;
      }
      if (mineOnly && product.ownerId !== user?.id) {
        return false;
      }
      if (rejectedOnly && product.reviewStatus !== "Rejected") {
        return false;
      }
      if (query && !product.name.toLowerCase().includes(query)) {
        return false;
      }
      return true;
    });

    return filtered.sort((a, b) => {
      if (currentSort === "oldest") {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      const priorityMap: Record<string, number> = { "High": 3, "Medium": 2, "Low": 1 };
      const valA = priorityMap[a.priority ?? "Low"] || 1;
      const valB = priorityMap[b.priority ?? "Low"] || 1;
      
      if (valA !== valB) {
        return currentSort === "highest" ? valB - valA : valA - valB;
      }
      // fallback to rank (creation order roughly)
      return a.rank - b.rank;
    });
  }, [
    products,
    isAdmin,
    currentCategory,
    currentSubcategory,
    currentStatusFilter,
    mineOnly,
    rejectedOnly,
    user,
    searchTerm,
    currentSort,
  ]);

  const handleCategoryChange = (value: string) => {
    setCurrentCategory(value);
    setCurrentSubcategory("all");
    setGridFolder(null);
  };

  // Lead-only inline stage change from the list row (Lead has unrestricted
  // status write per enforce_product_update_permissions). Also the natural
  // spot for the Not Started -> Design kickoff. The realtime
  // products subscription refreshes the list.
  const handleInlineStage = async (product: Product, next: PipelineStatus) => {
    if (product.items[0].status === next) return;
    const supabase = createClient();
    await supabase.from("products").update({ status: next }).eq("id", product.id);
  };

  const toggleExpanded = (rank: number) => {
    setExpandedRanks((prev) => {
      const next = new Set(prev);
      if (next.has(rank)) {
        next.delete(rank);
      } else {
        next.add(rank);
      }
      return next;
    });
  };

  const handleDeleteProduct = async (product: Product) => {
    setDeleting(true);
    try {
      const supabase = createClient();
      await supabase.from("products").delete().eq("id", product.id);
    } finally {
      setDeleting(false);
      setDeleteConfirm(null);
    }
  };

  if (loading && products.length === 0) {
    return (
      <div>
        <PageHeader title="Video Library | BuckedUp" overline="CATALOG" />
        <div className="empty-state">Loading video requests…</div>
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
        subtitle="Priority-ranked shot list — grows automatically as new products are requested, across any category in the catalog."
      />
      <div className="library-container">
        <div className="library-header">
          <div className="filter-row-left">
            <select
              className="filter-select"
              value={currentCategory}
              onChange={(event) => handleCategoryChange(event.target.value)}
            >
              <option value="all">All categories ({products.length})</option>
              {Object.keys(CATEGORY_TREE).map((category) => (
                <option key={category} value={category}>
                  {category} ({categoryCountProducts(products, category)})
                </option>
              ))}
            </select>
            <select
              className="filter-select"
              value={currentSubcategory}
              disabled={currentCategory === "all"}
              onChange={(event) => setCurrentSubcategory(event.target.value)}
            >
              {currentCategory === "all" ? (
                <option value="all">Select category first</option>
              ) : (
                <>
                  <option value="all">
                    All subcategories (
                    {categoryCountProducts(products, currentCategory)})
                  </option>
                  {CATEGORY_TREE[currentCategory].map((subcategory) => (
                    <option key={subcategory} value={subcategory}>
                      {subcategory} (
                      {subcategoryCountProducts(
                        products,
                        currentCategory,
                        subcategory,
                      )}
                      )
                    </option>
                  ))}
                </>
              )}
            </select>
            <div style={{ width: '1px', height: '20px', background: 'var(--glass-border)', margin: '0 8px', alignSelf: 'center' }} />
            {isAdmin ? null : (
              <div className="filter-pills">
                {STATUS_FILTERS.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    className={`pill${currentStatusFilter === filter.value ? " active" : ""}`}
                    onClick={() => setCurrentStatusFilter(filter.value)}
                  >
                    {filter.label}
                  </button>
                ))}
                <div style={{ width: '1px', height: '20px', background: 'var(--glass-border)', margin: '0 8px', alignSelf: 'center' }} />
                {role === "operator" || role === "lead" ? (
                  <button
                    type="button"
                    className={`pill${mineOnly ? " active" : ""}`}
                    onClick={() => setMineOnly((prev) => !prev)}
                  >
                    My items
                  </button>
                ) : null}
                <button
                  type="button"
                  className={`pill${rejectedOnly ? " active" : ""}`}
                  onClick={() => setRejectedOnly((prev) => !prev)}
                >
                  Rejected
                </button>
              </div>
            )}
          </div>
          <div className="filter-group" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {isAdmin ? null : (
              <div className="layout-toggle">
                <button
                  type="button"
                  className={`pill${layout === "table" ? " active" : ""}`}
                  onClick={() => setLayout("table")}
                  title="List view"
                >
                  <List size={16} />
                </button>
                <button
                  type="button"
                  className={`pill${layout === "grid" ? " active" : ""}`}
                  onClick={() => setLayout("grid")}
                  title="Grid view"
                >
                  <LayoutGrid size={16} />
                </button>
                <button
                  type="button"
                  className={`pill${layout === "board" ? " active" : ""}`}
                  onClick={() => setLayout("board")}
                  title="Board view"
                >
                  <Kanban size={16} />
                </button>
              </div>
            )}
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <input
                type="text"
                className="search-input"
                style={{ paddingLeft: '36px' }}
                placeholder="Search product…"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
              <svg
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--ink-soft)',
                  pointerEvents: 'none'
                }}
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
            </div>
            <select
              value={currentSort}
              onChange={(e) => setCurrentSort(e.target.value as any)}
              style={{
                height: "38px",
                borderRadius: "12px",
                padding: "0 12px",
                border: "1px solid var(--border-color)",
                backgroundColor: "var(--bg-card)",
                color: "var(--ink)",
                fontSize: "14px",
              }}
            >
              <option value="highest">Priority (Highest First)</option>
              <option value="lowest">Priority (Lowest First)</option>
              <option value="oldest">Oldest First</option>
            </select>
            {canManageCatalog ? (
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="issue-submit-btn"
                  onClick={() => setRequestCatalogModalOpen(true)}
                  style={{ height: "38px", borderRadius: "12px" }}
                >
                  + Request from Catalog
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="library-body">
          {layout === "grid" ? (
            gridFolder === null && currentCategory === "all" ? (
              <div className="isolated-scroll" style={{ flex: 1 }}>
                <CategoryFolderGrid
                  products={filteredProducts}
                  currentStatusFilter={currentStatusFilter}
                  rejectedOnly={rejectedOnly}
                  currentCategory={currentCategory}
                  onOpenFolder={(category) => setGridFolder(category)}
                />
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                <div style={{ flexShrink: 0 }}>
                  <button
                  type="button"
                  className="folder-back"
                  onClick={() => {
                    setGridFolder(null);
                    setCurrentCategory("all");
                  }}
                >
                  ← All categories
                  </button>
                  <div className="section-heading" style={{ fontSize: "28px", fontWeight: 800, margin: "12px 0 24px" }}>
                    {currentCategory !== "all" ? currentCategory : gridFolder}
                  </div>
                </div>
                <div className="isolated-scroll" style={{ flex: 1 }}>
                  <ProductThumbnailGrid
                    products={filteredProducts.filter((p) => p.category === (currentCategory !== "all" ? currentCategory : gridFolder))}
                    onOpenModal={onOpenModal}
                  />
                </div>
              </div>
            )
          ) : filteredProducts.length === 0 ? (
            <div className="empty-state">
              No products currently requested in this category yet — it will
              appear here automatically once BuckedUp adds one.
            </div>
          ) : layout === "board" ? (
            <div className="isolated-scroll" style={{ flex: 1 }}>
              <KanbanBoard
                products={filteredProducts}
                issues={issues}
                canMoveStage={canManageCatalog}
                profileEmailById={profileEmailById}
                onOpenModal={onOpenModal}
                theme={theme}
              />
            </div>
          ) : (
            <div className="isolated-scroll" style={{ flex: 1 }}>
              <div className="video-list">
              {filteredProducts.map((product, index) => {
                const displayRank = index + 1;
                const priority = product.priority ?? "Low";
                const priorityClass = priority === "High" ? "bg-red-500/10 text-red-500 border-red-500/20" : priority === "Medium" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : "bg-blue-500/10 text-blue-500 border-blue-500/20";
                const item = product.items[0];
                const modalKey = getModalKey(product.rank, 0);
                const expanded = expandedRanks.has(product.rank);
                const rowIssues = issues.filter(
                  (issue) => issue.rank === product.rank,
                );
                const openCount = rowIssues.filter(
                  (issue) => issue.status === "open",
                ).length;

                // Deliverable-flow flags for this row (Phase D).
                const isDesign = item.status === "Design";
                const isReview = item.status === "In Review";
                const storyboardDel = currentByKey.get(`${product.id}:Storyboarding`) ?? null;
                const scriptDel = currentByKey.get(`${product.id}:Scripting`) ?? null;

                // Operators may only submit for products they own (the
                // stage_deliverables insert RLS requires owner_id = auth.uid),
                // so don't show a doomed button for others' items.
                const canSubmit =
                  role === "operator" &&
                  product.ownerId === user?.id &&
                  product.deliveryType === "pipeline" &&
                  OPERATOR_SUBMIT_STAGES.includes(item.status);
                const canReview =
                  (role === "lead" || role === "admin") &&
                  product.deliveryType === "pipeline" &&
                  LEAD_REVIEW_STAGES.includes(item.status);
                // A Lead's "needs attention": a pending doc deliverable, or a
                // video parked in In Review.
                const awaitingReview =
                  isReview ||
                  (isDesign &&
                    (storyboardDel?.decision === "pending" ||
                      scriptDel?.decision === "pending"));
                const publishedText = product.publishDate
                  ? new Date(`${product.publishDate}T00:00:00`).toLocaleDateString("en-US", { timeZone: "UTC" })
                  : "—";

                return (
                  <div key={product.rank} className="video-list-card-wrap">
                    <div
                      className="video-list-card"
                      onClick={() => onOpenModal(modalKey)}
                    >
                      <div className="vlc-rank" title={`Queue Index: ${displayRank}`}>{displayRank}</div>

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
                          <span className={`status-pill ${priorityClass} font-bold mr-1`}>{priority} Priority</span>
                          <span className="vlc-tag">{product.category}</span>
                          <span className="vlc-tag vlc-tag-sub">{product.subcategory}</span>
                          {product.deliveryType === "link" ? (
                            <span className="vlc-tag vlc-tag-link">Link-only</span>
                          ) : null}
                          {product.reviewStatus &&
                            product.reviewStatus !== "Not Started" ? (
                            <span
                              className={`status-pill ${reviewStatusClass(product.reviewStatus)}`}
                              title={
                                product.reviewStatus === "Rejected"
                                  ? (product.rejectionReason ?? undefined)
                                  : undefined
                              }
                            >
                              {product.reviewStatus}
                            </span>
                          ) : null}
                        </div>
                        <div className="vlc-meta">
                          Date Published: {publishedText}
                          <span className="vlc-meta-sep"> · </span>
                          {languageFlag(product.language)} {product.language}
                        </div>
                        {product.contentAngle ? (
                          <div className="vlc-desc">{product.contentAngle}</div>
                        ) : null}
                      </div>

                      <div
                        className="vlc-side"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <div className="vlc-side-top">
                          {canManageCatalog ? (
                            <select
                              className="vlc-stage-select"
                              value={item.status}
                              onClick={(event) => event.stopPropagation()}
                              onChange={(event) => handleInlineStage(product, event.target.value as PipelineStatus)}
                            >
                              {STATUS_ORDER.map((s) => (
                                <option key={s} value={s} disabled={s === "Published" && product.reviewStatus === "Rejected"}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className={`status-pill ${STATUS_CLASS[item.status]}`}>
                              {item.status}
                            </span>
                          )}

                          <div className="row-actions">
                            {canManageCatalog || role === "operator" ? (
                              <button
                                type="button"
                                className="row-action-btn row-action-edit"
                                title={role === "operator" ? "View product details" : "Edit product"}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setFormModal({ mode: "edit", product });
                                }}
                              >
                                {role === "operator" ? (
                                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                    <circle cx="12" cy="12" r="3" />
                                  </svg>
                                ) : (
                                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                  </svg>
                                )}
                              </button>
                            ) : null}
                            {canSubmit ? (
                              <button
                                type="button"
                                className="row-action-btn row-action-edit"
                                title="Submit deliverable"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setProductionModal(product);
                                }}
                              >
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                  <polyline points="17 8 12 3 7 8" />
                                  <line x1="12" y1="3" x2="12" y2="15" />
                                </svg>
                              </button>
                            ) : null}
                            {canReview ? (
                              <button
                                type="button"
                                className={`row-action-btn row-action-review${awaitingReview ? " has-issues" : ""}`}
                                title={awaitingReview ? "Review — awaiting your decision" : "Review"}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setReviewModal(product);
                                }}
                              >
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                                {awaitingReview ? <span className="row-action-badge">!</span> : null}
                              </button>
                            ) : null}
                            {role !== "operator" ? (
                              <button
                                type="button"
                                className={`row-action-btn row-action-flag${openCount > 0 ? " has-issues" : ""}`}
                                title={openCount > 0 ? `${openCount} open issue${openCount === 1 ? "" : "s"}` : "Flag issue"}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggleExpanded(product.rank);
                                }}
                              >
                                <svg viewBox="0 0 24 24" width="16" height="16" fill={openCount > 0 ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                                  <line x1="4" y1="22" x2="4" y2="15" />
                                </svg>
                                {openCount > 0 ? <span className="row-action-badge">{openCount}</span> : null}
                              </button>
                            ) : null}
                          </div>
                        </div>

                        <div className="vlc-progress">
                          <div className="table-progress-track">
                            <div
                              className="table-progress-fill"
                              style={{ width: `${productProgressPct(product)}%` }}
                            />
                          </div>
                          <span className="table-progress-pct">
                            {Math.round(productProgressPct(product))}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="expand-wrapper" style={{
                      display: 'grid',
                      gridTemplateRows: expanded ? '1fr' : '0fr',
                      opacity: expanded ? 1 : 0,
                      transition: 'grid-template-rows 0.35s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.25s ease'
                    }}>
                      <div style={{ overflow: 'hidden' }}>
                        <RowDetail
                          product={product}
                          issues={rowIssues}
                          isAuthenticated={isAuthenticated}
                          ownerEmail={
                            product.ownerId
                              ? profileEmailById.get(product.ownerId)
                              : undefined
                          }
                          onReportIssue={reportIssue}
                          onResolveIssue={(id) => resolveIssue(id, product.id)}
                          canDelete={canManageCatalog}
                          canReportIssue={role !== "operator"}
                          onDeleteRequest={() => setDeleteConfirm(product)}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          )}
        </div>
      </div>

      {formModal ? (
        <ProductFormModal
          mode={formModal.mode}
          product={formModal.product}
          nextRank={nextRank}
          onClose={() => setFormModal(null)}
        />
      ) : null}

      {requestCatalogModalOpen ? (
        <RequestVideoModal
          nextRank={nextRank}
          onSuccess={() => setRequestCatalogModalOpen(false)}
          onClose={() => setRequestCatalogModalOpen(false)}
        />
      ) : null}

      {productionModal ? (
        <ProductionModal
          product={productionModal}
          onClose={() => setProductionModal(null)}
        />
      ) : null}

      {reviewModal ? (
        <ProductReviewModal
          product={reviewModal}
          onClose={() => setReviewModal(null)}
        />
      ) : null}

      {deleteConfirm ? (
        <div
          onClick={() => setDeleteConfirm(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#0d1310",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 16,
              width: "100%",
              maxWidth: 440,
              margin: "0 16px",
              boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#f87171" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6" /><path d="M14 11v6" />
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                  </svg>
                </div>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#f87171" }}>Delete product?</h2>
              </div>
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 18, cursor: "pointer", lineHeight: 1, padding: 4 }}
              >✕</button>
            </div>

            {/* Body */}
            <div style={{ padding: "0 24px 8px", color: "rgba(255,255,255,0.65)", fontSize: 14, lineHeight: 1.65 }}>
              <p style={{ margin: "0 0 8px" }}>You are about to permanently delete:</p>
              <p style={{ margin: "0 0 10px", fontWeight: 700, color: "#fff", fontSize: 15, padding: "8px 12px", background: "rgba(255,255,255,0.04)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.07)" }}>
                "{deleteConfirm.name}"
              </p>
              <p style={{ margin: 0 }}>This removes the product and all its data from the database. <strong style={{ color: "#fca5a5" }}>This cannot be undone.</strong></p>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", padding: "20px 24px 24px" }}>
              <button
                type="button"
                className="issue-submit-btn"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }}
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="issue-submit-btn"
                style={{ background: "#7f1d1d", border: "1px solid #f87171", color: "#fca5a5", display: "inline-flex", alignItems: "center", gap: 6 }}
                onClick={() => handleDeleteProduct(deleteConfirm)}
                disabled={deleting}
              >
                {deleting ? (
                  "Deleting…"
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6" /><path d="M14 11v6" />
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                    Yes, delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

interface RowDetailProps {
  product: Product;
  issues: Issue[];
  isAuthenticated: boolean;
  ownerEmail: string | undefined;
  onReportIssue: (
    rank: number,
    description: string,
    severity: IssueSeverity,
  ) => Promise<void>;
  onResolveIssue: (id: string) => Promise<void>;
  canDelete: boolean;
  canReportIssue: boolean;
  onDeleteRequest: () => void;
}

function RowDetail({
  product,
  issues,
  isAuthenticated,
  ownerEmail,
  onReportIssue,
  onResolveIssue,
  canDelete,
  canReportIssue,
  onDeleteRequest,
}: RowDetailProps) {
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<IssueSeverity>("medium");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!description.trim()) return;
    setSubmitting(true);
    try {
      await onReportIssue(product.rank, description.trim(), severity);
      setDescription("");
      setSeverity("medium");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="row-detail">
      <div className="detail-meta-row">
        <span className="detail-meta-item">
          <strong>Owner:</strong>{" "}
          {ownerEmail ?? product.owner ?? "Unassigned"}
        </span>
        {product.productUrl ? (
          <span className="detail-meta-item">
            <strong>Product:</strong>{" "}
            <a href={product.productUrl} target="_blank" rel="noopener noreferrer">
              {product.productUrl.replace(/^https?:\/\//, "")}
            </a>
          </span>
        ) : null}
      </div>
      {product.contentAngle ? (
        <div className="callout">
          <div className="content-angle-label">Content angle</div>
          {product.contentAngle}
        </div>
      ) : null}

      <div className="stage-history-panel">
        <div className="content-angle-label">Stage history</div>
        <StageHistoryLog productId={product.id} />
      </div>

      <div className="issue-panel">
        <div className="content-angle-label">Issues</div>
        {issues.length === 0 ? (
          <div className="issue-empty">No issues reported for this item.</div>
        ) : (
          <ul className="issue-list">
            {issues.map((issue) => (
              <li
                key={issue.id}
                className={`issue-item issue-${issue.severity}${issue.status === "resolved" ? " resolved" : ""
                  }`}
              >
                <span className="issue-severity">{issue.severity}</span>
                <span className="issue-desc">{issue.description}</span>
                {issue.status === "open" ? (
                  isAuthenticated ? (
                    <button
                      type="button"
                      className="issue-resolve-btn"
                      onClick={() => onResolveIssue(issue.id)}
                    >
                      Resolve
                    </button>
                  ) : null
                ) : (
                  <span className="issue-resolved-tag">Resolved</span>
                )}
              </li>
            ))}
          </ul>
        )}
        {isAuthenticated && canReportIssue ? (
          <div className="issue-form" style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            background: "rgba(255,255,255,0.02)",
            padding: "16px",
            borderRadius: "12px",
            border: "1px solid rgba(255,255,255,0.05)",
            marginTop: "16px"
          }}>
            <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
              <select
                value={severity}
                onChange={(event) =>
                  setSeverity(event.target.value as IssueSeverity)
                }
                style={{
                  padding: "10px",
                  borderRadius: "8px",
                  background: "rgba(0,0,0,0.2)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#fff",
                  outline: "none"
                }}
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
              </select>
              <input
                type="text"
                placeholder="Describe the issue..."
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && issues.every(i => i.status === "resolved")) handleSubmit();
                }}
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  borderRadius: "8px",
                  background: "rgba(0,0,0,0.2)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#fff",
                  outline: "none"
                }}
              />
            </div>
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              {issues.some(i => i.status === "open") ? (
                <div style={{ fontSize: "12px", color: "var(--saffron)", paddingLeft: "4px" }}>
                  Please resolve the current active issue before reporting a new one.
                </div>
              ) : <div />}
              <button
                type="button"
                className="issue-submit-btn"
                disabled={submitting || !description.trim() || issues.some(i => i.status === "open")}
                onClick={handleSubmit}
                style={{ alignSelf: "flex-end" }}
              >
                {submitting ? "Reporting…" : "Report issue"}
              </button>
            </div>
            {canDelete ? (
              <button
                type="button"
                className="issue-submit-btn"
                onClick={onDeleteRequest}
                title="Delete this product listing from the database"
                style={{
                  background: "rgba(127, 29, 29, 0.6)",
                  border: "1px solid rgba(248, 113, 113, 0.45)",
                  color: "#fca5a5",
                  display: "inline-flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
                Delete product
              </button>
            ) : null}
          </div>
        ) : (
          <div className="issue-empty">
            <Link href="/login">Sign in</Link> to report an issue.
          </div>
        )}
      </div>
    </div>
  );
}
