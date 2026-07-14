"use client";

import { ManageUsersView } from "@/components/templates/ManageUsersView";

// Admin is governance-only now: user-account management is its sole job
// (production-plan config moved to Lead's Planning tab, see PlanningView).
// So this is a thin wrapper around ManageUsersView rather than the old
// two-section pill switcher.
export function AdminView() {
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
        Admin
      </div>
      <div className="section-sub" style={{ marginBottom: "24px" }}>
        Manage Lead and Operator user accounts and their roles.
      </div>

      <ManageUsersView />
    </div>
  );
}
