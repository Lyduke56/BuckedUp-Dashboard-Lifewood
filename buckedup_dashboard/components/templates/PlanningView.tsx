"use client";

import { ProductionPlanView } from "@/components/templates/ProductionPlanView";

// Lead's Planning tab: configuring the production plan (targets, deadline,
// pacing) moved from Admin to Lead in Phase A, since production_plans is
// now lead-only to write. Thin wrapper around the unchanged
// ProductionPlanView so the tab has its own titled surface.
export function PlanningView() {
  return (
    <div>
      <div
        className="section-heading font-extrabold tracking-tight"
        style={{
          fontSize: "32px",
          borderLeftWidth: "6px",
          marginBottom: "12px",
          lineHeight: "1.2",
        }}
      >
        Planning
      </div>
      <div className="section-sub" style={{ marginBottom: "24px" }}>
        Configure production plan targets, pacing metrics, and the delivery
        deadline.
      </div>

      <ProductionPlanView />
    </div>
  );
}
