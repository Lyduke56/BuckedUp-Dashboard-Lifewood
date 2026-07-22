"use client";

import { ProductionPlanView } from "@/components/templates/ProductionPlanView";
import { PageHeader } from "@/components/molecules/PageHeader";

// Super-Admin's Planning tab: configuring the production plan (targets, deadline,
// pacing) is Super-Admin exclusive, since production_plans is now super-admin-only to
// write. Thin wrapper around the unchanged ProductionPlanView so the tab
// has its own titled surface.
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
