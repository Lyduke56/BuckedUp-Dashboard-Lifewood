"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CATEGORY_TREE, STATUS_CLASS, STATUS_ORDER, reviewStatusClass } from "@/lib/data";
import {
  DELIVERABLE_STAGES,
  type Issue,
  type IssueSeverity,
  type PipelineStatus,
  type Product,
  type StatusFilter,
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
import { useStageDeliverables } from "@/lib/useStageDeliverables";
import { KanbanBoard } from "./KanbanBoard";
import { ProductFormModal } from "./ProductFormModal";
import { ProductionModal } from "./ProductionModal";
import { ProductReviewModal } from "./ProductReviewModal";
import { StageHistoryLog } from "./StageHistoryLog";

// Stages an Operator can submit a deliverable for (the 3 doc/text stages
// plus Editing's video). A Lead reviews the same set plus In Review.
const OPERATOR_SUBMIT_STAGES = [...DELIVERABLE_STAGES, "Editing"] as string[];
const LEAD_REVIEW_STAGES = [...DELIVERABLE_STAGES, "Editing", "In Review"] as string[];

type LibraryLayout = "table" | "board";

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

interface VideoLibraryViewProps {
  onOpenModal: (key: string) => void;
  products: Product[];
  loading: boolean;
  error: string | null;
  externalSearch?: string | null;
  onExternalSearchApplied?: () => void;
  theme: "dark" | "light";
}

export function VideoLibraryView({
  onOpenModal,
  products,
  loading,
  error,
  externalSearch,
  onExternalSearchApplied,
  theme,
}: VideoLibraryViewProps) {
  const [currentCategory, setCurrentCategory] = useState("all");
  const [currentSubcategory, setCurrentSubcategory] = useState("all");
  const [currentStatusFilter, setCurrentStatusFilter] =
    useState<StatusFilter>("all");
  const [mineOnly, setMineOnly] = useState(false);
  const [rejectedOnly, setRejectedOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [layout, setLayout] = useState<LibraryLayout>("table");

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

  const [expandedRanks, setExpandedRanks] = useState<Set<number>>(new Set());
  const [formModal, setFormModal] = useState<{
    mode: "add" | "edit";
    product: Product | null;
  } | null>(null);
  const [productionModal, setProductionModal] = useState<Product | null>(null);
  const [reviewModal, setReviewModal] = useState<Product | null>(null);

  const { issues, reportIssue, resolveIssue } = useIssues();
  const { user, role } = useAuth();
  const { profiles } = useProfiles();
  const { currentByKey } = useStageDeliverables();
  const isAuthenticated = !!user;
  // Lead: full catalog access (add/edit/delete products, move stage via
  // ProductFormModal's Stage field) plus reviewing submitted deliverables.
  // Operator: execution-only — submits the deliverable for the current
  // stage, never moves the stage itself. Admin: governance-only, no
  // catalog access. See supabase/schema.sql's
  // enforce_product_update_permissions() for the DB-level version of
  // this same split — this is UI convenience, not the security boundary.
  const canManageCatalog = role === "lead";
  // Admin is governance-only: they can view the catalog but only its
  // Published slice, with no write affordances and no Board (nothing to
  // drag). Enforced in-page here rather than via a separate cut-down
  // component so the same filter/RowDetail machinery is reused.
  const isAdmin = role === "admin";
  const nextRank =
    products.length === 0 ? 1 : Math.max(...products.map((p) => p.rank)) + 1;
  const profileEmailById = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile.email])),
    [profiles],
  );

  const filteredProducts = useMemo(() => {
    const query = searchTerm.toLowerCase();
    return products.filter((product) => {
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
  ]);

  const handleCategoryChange = (value: string) => {
    setCurrentCategory(value);
    setCurrentSubcategory("all");
  };

  // Lead-only inline stage change from the list row (Lead has unrestricted
  // status write per enforce_product_update_permissions). Also the natural
  // spot for the Not Started -> Storyboarding kickoff. The realtime
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

  if (loading && products.length === 0) {
    return (
      <div>
        <div className="section-heading">Video Library</div>
        <div className="empty-state">Loading video requests…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="section-heading">Video Library</div>
        <div className="empty-state">Couldn&apos;t reach Supabase: {error}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="section-heading">Video Library</div>
      <div className="section-sub">
        Priority-ranked shot list — grows automatically as new products are
        requested, across any category in the catalog.
      </div>
      <div className="filter-row">
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
              <option value="all">All subcategories</option>
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
              {role === "operator" ? (
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
              >
                Table
              </button>
              <button
                type="button"
                className={`pill${layout === "board" ? " active" : ""}`}
                onClick={() => setLayout("board")}
              >
                Board
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
          {canManageCatalog ? (
            <button
              type="button"
              className="issue-submit-btn"
              onClick={() => setFormModal({ mode: "add", product: null })}
              style={{ height: '38px', borderRadius: '12px' }}
            >
              + Add product
            </button>
          ) : null}
        </div>
      </div>

      {filteredProducts.length === 0 ? (
        <div className="empty-state">
          No products currently requested in this category yet — it will
          appear here automatically once BuckedUp adds one.
        </div>
      ) : layout === "board" ? (
        <KanbanBoard
          products={filteredProducts}
          issues={issues}
          canMoveStage={canManageCatalog}
          profileEmailById={profileEmailById}
          onOpenModal={onOpenModal}
          theme={theme}
        />
      ) : (
        <div className="video-list">
          {filteredProducts.map((product) => {
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
            const currentDeliverable =
              currentByKey.get(`${product.id}:${item.status}`) ?? null;
            // Operators may only submit for products they own (the
            // stage_deliverables insert RLS requires owner_id = auth.uid),
            // so don't show a doomed button for others' items.
            const canSubmit =
              role === "operator" &&
              product.ownerId === user?.id &&
              product.deliveryType === "pipeline" &&
              OPERATOR_SUBMIT_STAGES.includes(item.status);
            const canReview =
              role === "lead" &&
              product.deliveryType === "pipeline" &&
              LEAD_REVIEW_STAGES.includes(item.status);
            // A Lead's "needs attention": a pending doc deliverable, or a
            // video parked in In Review.
            const awaitingReview =
              currentDeliverable?.decision === "pending" ||
              item.status === "In Review";
            const publishedText = product.publishDate
              ? new Date(`${product.publishDate}T00:00:00`).toLocaleDateString("en-US")
              : "—";

            return (
              <div key={product.rank} className="video-list-card-wrap">
                <div
                  className="video-list-card"
                  onClick={() => onOpenModal(modalKey)}
                >
                  <div className="vlc-rank">{product.rank}</div>

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
                            <option key={s} value={s}>
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
                        {canManageCatalog ? (
                          <button
                            type="button"
                            className="row-action-btn row-action-edit"
                            title="Edit product"
                            onClick={(event) => {
                              event.stopPropagation();
                              setFormModal({ mode: "edit", product });
                            }}
                          >
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
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
                      onResolveIssue={resolveIssue}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {formModal ? (
        <ProductFormModal
          mode={formModal.mode}
          product={formModal.product}
          nextRank={nextRank}
          onClose={() => setFormModal(null)}
        />
      ) : null}

      {productionModal ? (
        <ProductionModal
          product={productionModal}
          currentDeliverable={
            currentByKey.get(
              `${productionModal.id}:${productionModal.items[0].status}`,
            ) ?? null
          }
          onClose={() => setProductionModal(null)}
        />
      ) : null}

      {reviewModal ? (
        <ProductReviewModal
          product={reviewModal}
          currentDeliverable={
            currentByKey.get(
              `${reviewModal.id}:${reviewModal.items[0].status}`,
            ) ?? null
          }
          onClose={() => setReviewModal(null)}
        />
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
}

function RowDetail({
  product,
  issues,
  isAuthenticated,
  ownerEmail,
  onReportIssue,
  onResolveIssue,
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
        {isAuthenticated ? (
          <div className="issue-form">
            <select
              value={severity}
              onChange={(event) =>
                setSeverity(event.target.value as IssueSeverity)
              }
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <input
              type="text"
              placeholder="Describe the problem…"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleSubmit();
              }}
            />
            <button
              type="button"
              className="issue-submit-btn"
              disabled={submitting || !description.trim()}
              onClick={handleSubmit}
            >
              {submitting ? "Reporting…" : "Report issue"}
            </button>
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
