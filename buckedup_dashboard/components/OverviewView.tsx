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

      <div className="overview-grid">
        <div className="panel">
          <div className="section-heading">Requests by category</div>
          <div className="section-sub">
            Only categories with active video requests are shown — full
            breakdown across all 10 is in the completion chart below.
          </div>
          <OverviewSnapshot />
        </div>
        <div>
          <button type="button" className="cta-card" onClick={onBrowseLibrary}>
            <div className="cta-title">Browse the video library →</div>
            <div className="cta-sub">
              Filter by category, subcategory, or status
            </div>
          </button>
        </div>
      </div>

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
          <div className="chart-mt">
            <StatusChart />
          </div>
        </div>
        <div className="panel">
          <div className="section-heading section-heading-sm">
            Completion by category
          </div>
          <div className="chart-mt">
            <CategoryChart />
          </div>
        </div>
      </div>
      <div className="callout">
        Each video item moves through not started → scripting → filming →
        editing → in review → scheduled → published. Status is edited only in
        the source Google Sheet by whoever runs production — this dashboard
        reads and displays it automatically, with no editing surface of its
        own.
      </div>
    </>
  );
}
