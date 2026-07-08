"use client";

import type { Product } from "@/lib/types";
import { KpiRow } from "./KpiRow";
import { OverviewSnapshot } from "./OverviewSnapshot";
import { ProjectProgressCard } from "./ProjectProgressCard";

interface OverviewViewProps {
  onBrowseLibrary: () => void;
  products: Product[];
  isLoading?: boolean;
  hasError?: boolean;
}

export function OverviewView({
  onBrowseLibrary,
  products,
  isLoading,
  hasError,
}: OverviewViewProps) {
  return (
    <>
      <ProjectProgressCard products={products} />
      <KpiRow products={products} isLoading={isLoading} hasError={hasError} />

      <div className="overview-grid">
        <div className="panel">
          <div className="section-heading">Requests by category</div>
          <div className="section-sub">
            Only categories with active video requests are shown — full
            breakdown across all 10 is in the completion chart below.
          </div>
          <OverviewSnapshot products={products} />
        </div>

        <div className="cta-wrap">
          <button type="button" className="cta-card" onClick={onBrowseLibrary}>
            <div>
              <div className="cta-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="3" y="3" width="7" height="7" rx="1.5" />
                  <rect x="14" y="3" width="7" height="7" rx="1.5" />
                  <rect x="3" y="14" width="7" height="7" rx="1.5" />
                  <rect x="14" y="14" width="7" height="7" rx="1.5" />
                </svg>
              </div>
              <div className="cta-title">Browse the video library</div>
              <div className="cta-sub">
                Filter by category, subcategory, or status to find any item
                in the queue.
              </div>
            </div>
            <div className="cta-footer">
              Open library
              <svg
                className="cta-arrow"
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </div>
          </button>
        </div>
      </div>
    </>
  );
}