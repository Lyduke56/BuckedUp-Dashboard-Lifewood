import type { Product } from "@/lib/types";
import { KpiRow } from "./KpiRow";
import { OverviewSnapshot } from "./OverviewSnapshot";
import { ProjectProgressCard } from "./ProjectProgressCard";
import { ProductionOutputWidget } from "./ProductionOutputWidget";
import { RecentActivityWidget } from "./RecentActivityWidget";
import { Tilt } from "@/components/shared/Tilt";

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
    <div className="flex flex-col gap-6">
      <ProjectProgressCard products={products} />
      <KpiRow products={products} isLoading={isLoading} hasError={hasError} />

      {/* Row 1: Requests by category (2/3) & Production output (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="panel panel-glass lg:col-span-2 flex flex-col justify-between">
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
        <div className="lg:col-span-1 flex">
          <ProductionOutputWidget />
        </div>
      </div>

      {/* Row 2: Recent Deliveries (2/3) & Browse the library (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 flex">
          <RecentActivityWidget products={products} />
        </div>

        <div className="lg:col-span-1 flex">
          <Tilt maxTilt={4} className="w-full flex">
            <button
              type="button"
              className="cta-card w-full text-left p-6 relative overflow-hidden flex flex-col justify-between cursor-pointer"
              onClick={onBrowseLibrary}
              style={{ flex: 1, minHeight: '240px' }}
            >
              <div>
                <div className="cta-icon text-[var(--saffron)] mb-4">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    width="24"
                    height="24"
                  >
                    <rect x="3" y="3" width="7" height="7" rx="1.5" />
                    <rect x="14" y="3" width="7" height="7" rx="1.5" />
                    <rect x="3" y="14" width="7" height="7" rx="1.5" />
                    <rect x="14" y="14" width="7" height="7" rx="1.5" />
                  </svg>
                </div>
                <div className="cta-title text-white font-bold text-lg mb-1">Browse the video library</div>
                <div className="cta-sub text-slate-400 text-xs">
                  Filter by category, subcategory, or status to find any item in the queue.
                </div>
              </div>
              <div className="cta-footer flex items-center gap-1.5 text-xs font-semibold text-[var(--saffron)] mt-6">
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
          </Tilt>
        </div>
      </div>
    </div>
  );
}