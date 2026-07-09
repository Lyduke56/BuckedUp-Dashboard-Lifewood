"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CATEGORY_TREE, STATUS_CLASS, reviewStatusClass } from "@/lib/data";
import type { Issue, IssueSeverity, Product, StatusFilter } from "@/lib/types";
import {
  categoryCountProducts,
  getModalKey,
  productBucket,
  productProgressPct,
  subcategoryCountProducts,
} from "@/lib/utils";
import { useIssues } from "@/lib/useIssues";
import { useAuth } from "@/lib/useAuth";
import { useProfiles } from "@/lib/useProfiles";
import { KanbanBoard } from "./KanbanBoard";
import { ProductFormModal } from "./ProductFormModal";
import { ProductionModal } from "./ProductionModal";
import { ProductReviewModal } from "./ProductReviewModal";
import { StageHistoryLog } from "./StageHistoryLog";

type LibraryLayout = "table" | "board";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
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
}

export function VideoLibraryView({
  onOpenModal,
  products,
  loading,
  error,
  externalSearch,
  onExternalSearchApplied,
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
  const [reviewModal, setReviewModal] = useState<Product | null>(null);
  const [productionModal, setProductionModal] = useState<Product | null>(null);

  const { issues, reportIssue, resolveIssue } = useIssues();
  const { user, role } = useAuth();
  const { profiles } = useProfiles();
  const isAuthenticated = !!user;
  // Editor: stage + video only. Admin: full catalog (add/edit/delete).
  // Approver: review only. See supabase/schema.sql's
  // enforce_product_update_permissions() for the DB-level version of
  // this same split — this is UI convenience, not the security boundary.
  const canManageCatalog = role === "admin";
  const canMoveStage = role === "editor" || role === "admin";
  const canReview = role === "approver" || role === "admin";
  const nextRank =
    products.length === 0 ? 1 : Math.max(...products.map((p) => p.rank)) + 1;
  const profileEmailById = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile.email])),
    [profiles],
  );

  const filteredProducts = useMemo(() => {
    const query = searchTerm.toLowerCase();
    return products.filter((product) => {
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
      <div className="toolbar">
        <div className="filter-group">
          <select
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
            {role === "editor" ? (
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
        </div>
        <div className="filter-group">
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
          <input
            type="text"
            className="search-input"
            placeholder="Search product…"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
          {canManageCatalog ? (
            <button
              type="button"
              className="issue-submit-btn"
              onClick={() => setFormModal({ mode: "add", product: null })}
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
          canMoveStage={canMoveStage}
          profileEmailById={profileEmailById}
          onOpenModal={onOpenModal}
        />
      ) : (
        <div className="table-scroll">
          <table className="video-table">
            <colgroup>
              <col style={{ width: "5%" }} />
              <col style={{ width: "28%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "11%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>ID</th>
                <th>Video</th>
                <th>Language</th>
                <th>Stage</th>
                <th>Status</th>
                <th>Completed</th>
                <th>Progress</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
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

                return (
                  <Fragment key={product.rank}>
                    <tr
                      className="video-table-row"
                      onClick={() => onOpenModal(modalKey)}
                    >
                      <td className="video-table-id">{product.rank}</td>
                      <td className="video-table-name" title={product.name}>
                        <span className="video-table-name-text">
                          {product.name}
                        </span>
                      </td>
                      <td>
                        <span className="language-badge">
                          {languageFlag(product.language)} {product.language}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`status-pill ${STATUS_CLASS[item.status]}`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`status-pill ${reviewStatusClass(product.reviewStatus)}`}
                          title={
                            product.reviewStatus === "Rejected"
                              ? (product.rejectionReason ?? undefined)
                              : undefined
                          }
                        >
                          {product.reviewStatus ?? "Not Started"}
                        </span>
                      </td>
                      <td>{product.publishDate ?? "—"}</td>
                      <td>
                        <div className="table-progress">
                          <div className="table-progress-track">
                            <div
                              className="table-progress-fill"
                              style={{
                                width: `${productProgressPct(product)}%`,
                              }}
                            />
                          </div>
                          <span className="table-progress-pct">
                            {Math.round(productProgressPct(product))}%
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="row-actions">
                          {canMoveStage ? (
                            <button
                              type="button"
                              className="edit-btn"
                              title={role === "admin" ? "Edit product" : "Update stage / video"}
                              onClick={(event) => {
                                event.stopPropagation();
                                if (role === "admin") {
                                  setFormModal({ mode: "edit", product });
                                } else {
                                  setProductionModal(product);
                                }
                              }}
                            >
                              ✎
                            </button>
                          ) : null}
                          {canReview ? (
                            <button
                              type="button"
                              className="edit-btn"
                              title="Review"
                              onClick={(event) => {
                                event.stopPropagation();
                                setReviewModal(product);
                              }}
                            >
                              ✓
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className={`issue-btn${openCount > 0 ? " has-issues" : ""}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleExpanded(product.rank);
                            }}
                          >
                            🚩{openCount > 0 ? ` ${openCount}` : ""}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expanded ? (
                      <tr className="video-table-expand-row">
                        <td colSpan={8}>
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
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
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

      {reviewModal ? (
        <ProductReviewModal
          product={reviewModal}
          onClose={() => setReviewModal(null)}
        />
      ) : null}

      {productionModal ? (
        <ProductionModal
          product={productionModal}
          onClose={() => setProductionModal(null)}
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
                className={`issue-item issue-${issue.severity}${
                  issue.status === "resolved" ? " resolved" : ""
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
