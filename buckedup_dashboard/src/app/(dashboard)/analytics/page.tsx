"use client";

import { useDashboard } from "@/contexts/DashboardContext";
import { StatusChart } from "@/components/analytics/StatusChart";
import { CategoryChart } from "@/components/analytics/CategoryChart";

export default function AnalyticsPage() {
  const { products } = useDashboard();

  return (
    <div className="animate-fadeUp">
      <div className="mb-[3px] text-base font-extrabold text-serpent">
        Analytics
      </div>
      <p className="mb-[18px] text-[12.5px] font-semibold text-ink-soft">
        Current snapshot of the queue — reflects live checklist state from
        the video library.
      </p>

      <div className="grid grid-cols-1 items-start gap-[18px] md:grid-cols-2">
        <div className="rounded-card border border-line bg-white p-5">
          <div className="mb-1 text-sm font-extrabold text-serpent">
            Production status
          </div>
          <div className="mt-2.5">
            <StatusChart products={products} />
          </div>
        </div>
        <div className="rounded-card border border-line bg-white p-5">
          <div className="mb-1 text-sm font-extrabold text-serpent">
            Completion by category
          </div>
          <div className="mt-2.5">
            <CategoryChart products={products} />
          </div>
        </div>
      </div>

      <div className="mt-[18px] rounded-[10px] border-l-[3px] border-castleton bg-castleton/[.06] p-[14px_18px] text-xs font-semibold leading-relaxed text-ink-soft">
        This view tracks a simple not started → in progress → published
        state per product. Once each video is assigned an owner, finer
        grained stages (scripting → filming → editing → in review →
        scheduled) from the production plan can be layered in.
      </div>
    </div>
  );
}
