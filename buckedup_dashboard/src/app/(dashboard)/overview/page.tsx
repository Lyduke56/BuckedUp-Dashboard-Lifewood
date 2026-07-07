"use client";

import { useDashboard } from "@/contexts/DashboardContext";
import { KpiRow } from "@/components/overview/KpiRow";
import { CategorySnapshot } from "@/components/overview/CategorySnapshot";
import { CtaCards } from "@/components/overview/CtaCards";

export default function OverviewPage() {
  const { products } = useDashboard();

  return (
    <div className="animate-fadeUp">
      <KpiRow products={products} />
      <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[1.4fr_1fr]">
        <CategorySnapshot products={products} />
        <CtaCards />
      </div>
    </div>
  );
}
