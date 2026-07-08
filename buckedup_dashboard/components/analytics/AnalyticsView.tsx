import type { Product } from "@/lib/types";
import { DailyProgressChart } from "./DailyProgressChart";
import { LanguageProgressChart } from "./LanguageProgressChart";
import { ReviewStatusChart } from "./ReviewStatusChart";

interface AnalyticsViewProps {
  products: Product[];
}

export function AnalyticsView({ products }: AnalyticsViewProps) {
  return (
    <div>
      <div className="section-heading">Analytics</div>
      <div className="section-sub">
        Current snapshot of the queue&apos;s review state, plus delivery
        progress by language — reflects the live production stage of every
        item in the library.
      </div>
      <div className="analytics-grid">
        <div className="panel">
          <div className="section-heading section-heading-sm">
            Review status distribution
          </div>
          <div className="panel-accent" />
          <div className="chart-mt">
            <ReviewStatusChart products={products} />
          </div>
          <div className="callout callout-inline">
            The Sheet&apos;s Status column — a review/approval state, separate
            from the production pipeline stage shown in the Video Library
            table.
          </div>
        </div>
        <div className="panel">
          <div className="section-heading section-heading-sm">
            Delivery progress by language
          </div>
          <div className="panel-accent" />
          <div className="chart-mt">
            <LanguageProgressChart products={products} />
          </div>
        </div>
      </div>

      <hr className="section-divider" />
      <div className="panel">
        <div className="section-heading section-heading-sm">
          Daily target vs actual
        </div>
        <div className="panel-accent" />
        <div className="chart-mt">
          <DailyProgressChart points={[]} />
        </div>
      </div>
    </div>
  );
}
