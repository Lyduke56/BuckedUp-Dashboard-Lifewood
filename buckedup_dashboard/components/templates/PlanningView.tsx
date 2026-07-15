"use client";

import { ProductionPlanView } from "@/components/templates/ProductionPlanView";
import { PageHeader } from "@/components/molecules/PageHeader";

// Lead's Planning tab: configuring the production plan (targets, deadline,
// pacing) moved from Admin to Lead in Phase A, since production_plans is
// now lead-only to write. Thin wrapper around the unchanged
// ProductionPlanView so the tab has its own titled surface.
export function PlanningView() {
  return (
    <div>
      <PageHeader 
        title="Planning | BuckedUp" 
        overline="PRODUCTION"
        subtitle="Configure production plan targets, pacing metrics, and the delivery deadline."
      />

      <ProductionPlanView />
    </div>
  );
}
