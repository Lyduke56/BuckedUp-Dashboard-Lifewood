"use client";

import { ManageUsersView } from "@/components/templates/ManageUsersView";
import { PageHeader } from "@/components/molecules/PageHeader";

// Admin is governance-only now: user-account management is its sole job
// (production-plan config moved to Lead's Planning tab, see PlanningView).
// So this is a thin wrapper around ManageUsersView rather than the old
// two-section pill switcher.
export function AdminView() {
  return (
    <div>
      <PageHeader 
        title="Admin | BuckedUp" 
        overline="GOVERNANCE"
        subtitle="Manage Lead and Operator user accounts and their roles."
      />

      <ManageUsersView />
    </div>
  );
}
