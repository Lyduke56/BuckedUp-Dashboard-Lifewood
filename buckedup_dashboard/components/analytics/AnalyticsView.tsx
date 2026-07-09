import { MOCK_DAILY_PROGRESS } from "@/lib/data";
import type { Product } from "@/lib/types";
import { useStageAge } from "@/lib/useStageAge";
import { CategoryChart } from "./CategoryChart";
import { DailyProgressChart } from "./DailyProgressChart";
import { LanguageProgressChart } from "./LanguageProgressChart";
import { ReviewStatusChart } from "./ReviewStatusChart";
import { StageAgeChart } from "./StageAgeChart";
import { StatusChart } from "./StatusChart";

interface AnalyticsViewProps {
  products: Product[];
}

export function AnalyticsView({ products }: AnalyticsViewProps) {
  const { stageAgeByProductId } = useStageAge();

  return (
    <div>
      <div className="section-heading">Analytics</div>
      <div className="section-sub">
        Current snapshot of the queue — reflects the live production stage
        and review state of every item in the library.
      </div>
      <div className="panel">
        <div className="section-heading section-heading-sm">
          Daily target vs actual
        </div>
        <div className="panel-accent" />
        <div className="chart-mt">
          <DailyProgressChart points={MOCK_DAILY_PROGRESS} />
        </div>
      </div>
      <hr className="section-divider" />
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
            A review/approval state, separate from the production pipeline
            stage shown above.
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
      <div className="analytics-grid">
        <div className="panel">
          <div className="section-heading section-heading-sm">
            Production stage distribution
          </div>
          <div className="panel-accent" />
          <div className="chart-mt">
            <StatusChart products={products} />
          </div>
          <div className="callout callout-inline">
            One column, stacked by current stage — reads bottom-to-top as not
            started → published, so a taller top segment means more of the
            queue has cleared production. Editing a product&apos;s stage in
            the Video Library updates this chart live.
          </div>
        </div>
        <div className="panel">
          <div className="section-heading section-heading-sm">
            Completion by category
          </div>
          <div className="panel-accent" />
          <div className="chart-mt">
            <CategoryChart products={products} />
          </div>
        </div>
      </div>
      <hr className="section-divider" />
      <div className="panel">
        <div className="section-heading section-heading-sm">
          Time in current stage
        </div>
        <div className="panel-accent" />
        <div className="chart-mt">
          <StageAgeChart stageAgeByProductId={stageAgeByProductId} />
        </div>
        <div className="callout callout-inline">
          Average days products currently sitting in each stage have been
          there — a taller bar means that stage is where work is piling up.
        </div>
      </div>
    </div>
  );
}
