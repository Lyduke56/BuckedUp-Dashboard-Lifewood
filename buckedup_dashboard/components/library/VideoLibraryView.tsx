"use client";

import { Fragment, useMemo, useState } from "react";
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
}

export function VideoLibraryView({
  onOpenModal,
  products,
  loading,
  error,
}: VideoLibraryViewProps) {
  const [currentCategory, setCurrentCategory] = useState("all");
  const [currentSubcategory, setCurrentSubcategory] = useState("all");
  const [currentStatusFilter, setCurrentStatusFilter] =
    useState<StatusFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedRanks, setExpandedRanks] = useState<Set<number>>(new Set());

  const { issues, reportIssue, resolveIssue } = useIssues();

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
        <div className="empty-state">
          Couldn&apos;t reach the Google Sheet: {error}
        </div>
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
          </div>
        </div>
        <input
          type="text"
          className="search-input"
          placeholder="Search product…"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
      </div>

      {filteredProducts.length === 0 ? (
        <div className="empty-state">
          No products currently requested in this category yet — it will
          appear here automatically once BuckedUp adds one.
        </div>
      ) : (
        <div className="table-scroll">
          <table className="video-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Video</th>
                <th>Type</th>
                <th>Language</th>
                <th>Stage</th>
                <th>Status</th>
                <th>Watch</th>
                <th>Completed</th>
                <th>Progress</th>
                <th>Issue</th>
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
                      onClick={() => toggleExpanded(product.rank)}
                    >
                      <td className="video-table-id">{product.rank}</td>
                      <td className="video-table-name">
                        <span
                          className={`expand-caret${expanded ? " open" : ""}`}
                        >
                          ▸
                        </span>
                        {product.name}
                      </td>
                      <td>{product.type || "—"}</td>
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
                        >
                          {product.reviewStatus ?? "Not Started"}
                        </span>
                      </td>
                      <td>
                        {item.videoUrl ? (
                          <button
                            type="button"
                            className="video-link"
                            onClick={(event) => {
                              event.stopPropagation();
                              onOpenModal(modalKey);
                            }}
                          >
                            ▶ Watch
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="preview-btn"
                            onClick={(event) => {
                              event.stopPropagation();
                              onOpenModal(modalKey);
                            }}
                          >
                            Preview
                          </button>
                        )}
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
                      </td>
                    </tr>
                    {expanded ? (
                      <tr className="video-table-expand-row">
                        <td colSpan={10}>
                          <RowDetail
                            product={product}
                            issues={rowIssues}
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
    </div>
  );
}

interface RowDetailProps {
  product: Product;
  issues: Issue[];
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
          <strong>Owner:</strong> {product.owner ?? "Unassigned"}
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
                  <button
                    type="button"
                    className="issue-resolve-btn"
                    onClick={() => onResolveIssue(issue.id)}
                  >
                    Resolve
                  </button>
                ) : (
                  <span className="issue-resolved-tag">Resolved</span>
                )}
              </li>
            ))}
          </ul>
        )}
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
      </div>
    </div>
  );
}
