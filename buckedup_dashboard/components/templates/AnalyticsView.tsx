import { useState, useMemo } from "react";
import type { Product } from "@/lib/types";
import { PageHeader } from "@/components/molecules/PageHeader";
import { useStageAge } from "@/lib/useStageAge";
import { useProductionPlan } from "@/lib/useProductionPlan";
import { useDailyProgress } from "@/lib/useDailyProgress";
import { DailyProgressChart } from "@/components/organisms/DailyProgressChart";
import { LanguageProgressChart } from "@/components/organisms/LanguageProgressChart";
import { ReviewStatusChart } from "@/components/organisms/ReviewStatusChart";
import { StageAgeChart } from "@/components/organisms/StageAgeChart";
import { StatusChart } from "@/components/organisms/StatusChart";
import { FunnelChart } from "@/components/organisms/FunnelChart";
import { OwnerWorkloadChart } from "@/components/organisms/OwnerWorkloadChart";
import { RejectionRateChart } from "@/components/organisms/RejectionRateChart";
import { PlayCircle, ShieldCheck, HelpCircle } from "lucide-react";

interface AnalyticsViewProps {
  products: Product[];
}

export function AnalyticsView({ products }: AnalyticsViewProps) {
  const { stageAgeByProductId } = useStageAge();
  const { plan } = useProductionPlan();
  const dailyProgress = useDailyProgress(plan?.startDate, plan?.dailyAccumulativeTargets);

  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Filter products by the selected date range (based on createdAt).
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (!p.createdAt) return true;
      const createdDate = new Date(p.createdAt);
      if (startDate && createdDate < new Date(startDate)) return false;
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (createdDate > end) return false;
      }
      return true;
    });
  }, [products, startDate, endDate]);

  // Slice the daily-progress series to the same date window the global
  // date-range filter controls. The hook always fetches from plan start →
  // today; we just window the result here so no extra DB round-trip is
  // needed when the user adjusts the range.
  const filteredDailyProgress = useMemo(() => {
    if (!startDate && !endDate) return dailyProgress;
    return dailyProgress.filter((p) => {
      if (startDate && p.date < startDate) return false;
      if (endDate && p.date > endDate) return false;
      return true;
    });
  }, [dailyProgress, startDate, endDate]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Analytics | BuckedUp" 
        overline="PERFORMANCE" 
        subtitle="Current snapshot of the queue — reflects the live production stage, rejection analytics, and owner workloads."
      />

      <div className="flex items-center gap-4 py-3 px-4 bg-[var(--surface-sunken)] rounded-xl border border-[var(--glass-border)]">
        <span className="text-sm font-medium text-[var(--ink-soft)]">Date Range:</span>
        <input 
          type="date" 
          value={startDate} 
          onChange={(e) => setStartDate(e.target.value)}
          className="bg-transparent border border-[var(--line)] rounded-md px-3 py-1.5 text-sm outline-none focus:border-[var(--castleton)]"
        />
        <span className="text-[var(--ink-soft)]">to</span>
        <input 
          type="date" 
          value={endDate} 
          onChange={(e) => setEndDate(e.target.value)}
          className="bg-transparent border border-[var(--line)] rounded-md px-3 py-1.5 text-sm outline-none focus:border-[var(--castleton)]"
        />
        {(startDate || endDate) && (
          <button 
            type="button" 
            className="text-xs text-[var(--castleton)] font-medium hover:underline ml-2"
            onClick={() => { setStartDate(""); setEndDate(""); }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Tightly aligned 3-Column Grid representing the "invisible square" layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        
        {/* ================= ROW 1 ================= */}
        {/* Daily target vs actual */}
        <div className="panel flex flex-col lg:col-span-2">
          <div className="section-heading section-heading-sm">
            Daily target vs actual
          </div>
          <div className="chart-mt">
            <DailyProgressChart
              points={filteredDailyProgress}
              dailyTarget={plan?.categoryTargets ? Object.values(plan.categoryTargets).reduce((sum, val) => sum + Number(val), 0) : undefined}
            />
          </div>
        </div>

        {/* Review status distribution */}
        <div className="panel flex flex-col justify-between lg:col-span-1">
          <div>
            <div className="section-heading section-heading-sm">
              Review status distribution
            </div>
            <div className="chart-mt">
              <ReviewStatusChart products={filteredProducts} />
            </div>
          </div>
          <div className="callout callout-inline mt-6">
            <HelpCircle size={14} className="inline mr-1.5" />
            Approval state, separate from the production stage.
          </div>
        </div>

        {/* ================= ROW 2 ================= */}
        {/* Stage transition funnel */}
        <div className="panel flex flex-col lg:col-span-1">
          <div className="section-heading section-heading-sm">
            Stage transition funnel
          </div>
          <div className="section-sub text-[11px] mt-1">
            Cumulative progression showing pipeline conversion rates.
          </div>
          <div className="chart-mt">
            <FunnelChart products={filteredProducts} />
          </div>
        </div>

        {/* Time in current stage */}
        <div className="panel flex flex-col lg:col-span-1">
          <div className="section-heading section-heading-sm">
            Time in current stage
          </div>
          <div className="section-sub text-[11px] mt-1">
            Average days products have spent in their current stage.
          </div>
          <div className="chart-mt">
            <StageAgeChart products={filteredProducts} stageAgeByProductId={stageAgeByProductId} />
          </div>
        </div>

        {/* Production stage distribution */}
        <div className="panel flex flex-col lg:col-span-1">
          <div className="section-heading section-heading-sm">
            Production stage distribution
          </div>
          <div className="section-sub text-[11px] mt-1">
            Proportion of all items currently sitting in each stage.
          </div>
          <div className="chart-mt">
            <StatusChart products={filteredProducts} stageTargets={plan?.stageTargets} />
          </div>
        </div>

        {/* ================= ROW 3 ================= */}
        {/* Rejection rate by category */}
        <div className="panel flex flex-col lg:col-span-2">
          <div className="section-heading section-heading-sm">
            Rejection rate by category
          </div>
          <div className="chart-mt flex flex-col gap-4">
            <RejectionRateChart products={filteredProducts} />
          </div>
        </div>

        {/* Delivery progress by language */}
        <div className="panel flex flex-col lg:col-span-1">
          <div className="section-heading section-heading-sm">
            Delivery progress by language
          </div>
          <div className="chart-mt flex flex-col gap-4">
            <LanguageProgressChart products={filteredProducts} languageTargets={plan?.languageTargets} />
          </div>
        </div>

        {/* ================= ROW 4 ================= */}
        {/* Owner workload distribution */}
        <div className="panel flex flex-col lg:col-span-2">
          <div className="section-heading section-heading-sm">
            Owner workload distribution
          </div>
          <div className="section-sub text-[11px] mt-1">
            Current assignment counts and active vs published status per person.
          </div>
          <div className="chart-mt">
            <OwnerWorkloadChart products={filteredProducts} />
          </div>
        </div>

        {/* Production Pipeline Insights */}
        <div className="panel flex flex-col justify-between lg:col-span-1">
          <div>
            <div className="section-heading section-heading-sm mb-4">
              Production Pipeline Insights
            </div>
            <div className="flex flex-col gap-4 mt-4">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--castleton-glow)] text-[var(--castleton)] flex items-center justify-center flex-shrink-0">
                  <PlayCircle size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[var(--text-main)] mb-1">Queue fill rates</h4>
                  <p className="text-xs text-[var(--ink-soft)] leading-relaxed">
                    Production stages read bottom-to-top from &quot;Not Started&quot; to &quot;Published&quot;. A taller top segment indicates higher completion.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--castleton-glow)] text-[var(--castleton)] flex items-center justify-center flex-shrink-0">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[var(--text-main)] mb-1">Live editing</h4>
                  <p className="text-xs text-[var(--ink-soft)] leading-relaxed">
                    Products and stages are edited directly in this dashboard by signed-in editors and admins, and sync live via Supabase.
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
    </div>
  );
}


