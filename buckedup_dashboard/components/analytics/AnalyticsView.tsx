import { MOCK_DAILY_PROGRESS } from "@/lib/data";
import type { Product } from "@/lib/types";
import { useStageAge } from "@/lib/useStageAge";
import { CategoryChart } from "./CategoryChart";
import { DailyProgressChart } from "./DailyProgressChart";
import { LanguageProgressChart } from "./LanguageProgressChart";
import { ReviewStatusChart } from "./ReviewStatusChart";
import { StageAgeChart } from "./StageAgeChart";
import { StatusChart } from "./StatusChart";
import { PlayCircle, ShieldCheck, HelpCircle } from "lucide-react";

interface AnalyticsViewProps {
  products: Product[];
}

export function AnalyticsView({ products }: AnalyticsViewProps) {
  const { stageAgeByProductId } = useStageAge();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="section-heading">Analytics</div>
        <div className="section-sub">
          Current snapshot of the queue — reflects the live production stage
          and review state of every item in the library.
        </div>
      </div>

      {/* Masonry 2-Column Grid to stack panels of varying heights without vertical gaps */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left Column (2/3 span) - Stacks wide charts */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* Daily target vs actual */}
          <div className="panel flex flex-col">
            <div className="section-heading section-heading-sm">
              Daily target vs actual
            </div>
            <div className="chart-mt">
              <DailyProgressChart points={MOCK_DAILY_PROGRESS} />
            </div>
          </div>

          {/* Completion by category */}
          <div className="panel flex flex-col">
            <div className="section-heading section-heading-sm">
              Completion by category
            </div>
            <div className="chart-mt flex flex-col gap-4">
              <CategoryChart products={products} />
            </div>
          </div>

          {/* Production Pipeline Insights */}
          <div className="panel flex flex-col justify-between">
            <div>
              <div className="section-heading section-heading-sm mb-4">
                Production Pipeline Insights
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[var(--castleton-glow)] text-[var(--castleton)] flex items-center justify-center flex-shrink-0">
                    <PlayCircle size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[var(--text-main)] mb-1">Queue fill rates</h4>
                    <p className="text-xs text-[var(--ink-soft)] leading-relaxed">
                      Production stages read bottom-to-top from "Not Started" to "Published". A taller top segment indicates higher completion.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[var(--castleton-glow)] text-[var(--castleton)] flex items-center justify-center flex-shrink-0">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[var(--text-main)] mb-1">Source configuration</h4>
                    <p className="text-xs text-[var(--ink-soft)] leading-relaxed">
                      Data updates automatically from the master Google Sheet. Manual changes to pipeline status are disabled on this read-only dashboard.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="callout callout-inline mt-6">
              Pipeline states are monitored continuously to maintain optimal video queue health and resource distribution.
            </div>
          </div>

        </div>

        {/* Right Column (1/3 span) - Stacks compact widgets */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          
          {/* Review status distribution */}
          <div className="panel flex flex-col justify-between">
            <div>
              <div className="section-heading section-heading-sm">
                Review status distribution
              </div>
              <div className="chart-mt">
                <ReviewStatusChart products={products} />
              </div>
            </div>
            <div className="callout callout-inline mt-6">
              <HelpCircle size={14} className="inline mr-1.5" />
              Approval state, separate from the production stage.
            </div>
          </div>

          {/* Delivery progress by language */}
          <div className="panel flex flex-col">
            <div className="section-heading section-heading-sm">
              Delivery progress by language
            </div>
            <div className="chart-mt flex flex-col gap-4">
              <LanguageProgressChart products={products} />
            </div>
          </div>

          {/* Production stage distribution */}
          <div className="panel flex flex-col">
            <div className="section-heading section-heading-sm">
              Production stage distribution
            </div>
            <div className="chart-mt">
              <StatusChart products={products} />
            </div>
          </div>

        </div>

      </div>

      {/* Full-Width Stage Age Chart */}
      <hr className="section-divider" />
      <div className="panel flex flex-col">
        <div className="section-heading section-heading-sm">
          Time in current stage
        </div>
        <div className="chart-mt">
          <StageAgeChart stageAgeByProductId={stageAgeByProductId} />
        </div>
        <div className="callout callout-inline mt-6">
          Average days products currently sitting in each stage have been
          there — a taller bar means that stage is where work is piling up.
        </div>
      </div>
    </div>
  );
}
