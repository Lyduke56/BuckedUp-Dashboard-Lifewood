"use client";

import { CategoryChart } from "./CategoryChart";
import { KpiRow } from "./KpiRow";
import { OverviewSnapshot } from "./OverviewSnapshot";
import { StatusChart } from "./StatusChart";

interface OverviewViewProps {
  onBrowseLibrary: () => void;
}

export function OverviewView({ onBrowseLibrary }: OverviewViewProps) {
  return (
    <>
      <KpiRow />
      
      <hr className="section-divider" />
      <div className="overview-grid">
        <div className="panel">
          <div className="section-heading">Requests by category</div>
          <div className="section-sub">
            Only categories with active video requests are shown — full
            breakdown across all 10 is in the completion chart below.
          </div>
          <div className="panel-accent" />
          <OverviewSnapshot />
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

      <hr className="section-divider" />
      <div className="section-heading section-heading-spaced">Analytics</div>
      <div className="section-sub">
        Current snapshot of the queue — reflects the live production stage of
        every item in the library.
      </div>
      <div className="analytics-grid">
        <div className="panel">
          <div className="section-heading section-heading-sm">
            Production stage distribution
          </div>
          <div className="panel-accent" />
          <div className="chart-mt">
            <StatusChart />
          </div>
          <div className="callout callout-inline">
            Each video item moves through not started → scripting → filming →
            editing → in review → scheduled → published. Status is edited only
            in the source Google Sheet by whoever runs production — this
            dashboard reads and displays it automatically, with no editing
            surface of its own.
          </div>
        </div>
        <div className="panel">
          <div className="section-heading section-heading-sm">
            Completion by category
          </div>
          <div className="panel-accent" />
          <div className="chart-mt">
            <CategoryChart />
          </div>
        </div>
      </div>
    </>
  );
}