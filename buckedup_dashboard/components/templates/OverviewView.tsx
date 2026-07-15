import type { Product } from "@/lib/types";
import { PageHeader } from "@/components/molecules/PageHeader";
import { KpiRow } from "@/components/molecules/KpiRow";
import { OverviewSnapshot } from "@/components/organisms/OverviewSnapshot";
import { ProjectProgressCard } from "@/components/organisms/ProjectProgressCard";
import { ProductionOutputWidget } from "@/components/organisms/ProductionOutputWidget";
import { RecentActivityWidget } from "@/components/organisms/RecentActivityWidget";
import { Tilt } from "@/components/atoms/Tilt";
import { useProductionPlan } from "@/lib/useProductionPlan";

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
  const { plan } = useProductionPlan();
  const projectName = plan?.name || "Active Production Pipeline";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title={projectName} 
        overline="CURRENT PIPELINE"
      />
      <ProjectProgressCard products={products} />
      <KpiRow products={products} isLoading={isLoading} hasError={hasError} />

      {/* Main grid: left 2/3 stacks Snapshot + Recent Activity, right 1/3 is Production Output spanning both */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {/* Left column — stacks vertically */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Requests by category */}
          <div className="panel panel-glass flex flex-col justify-between">
            <div>
              <div className="section-heading font-bold mb-1">Requests by category</div>
              <div className="section-sub text-xs mb-6">
                Only categories with active video requests are shown — full
                breakdown across all 10 is in the completion chart below.
              </div>
              <div className="flex flex-col gap-4">
                <OverviewSnapshot products={products} />
              </div>
            </div>
          </div>

          {/* Recent deliveries */}
          <RecentActivityWidget products={products} />
        </div>

        {/* Right column — Production Output Widget stretches to fill the full height */}
        <div className="lg:col-span-1 flex flex-col">
          <div className="flex-1 flex">
            <ProductionOutputWidget />
          </div>
        </div>
      </div>
    </div>
  );
}