"use client";

import { useState } from "react";
import { ProductionPlanView } from "./ProductionPlanView";
import { ManageUsersView } from "./ManageUsersView";

type AdminTab = "plan" | "users";

// Both sections now share one scrollable area, switched by these pills,
// instead of stacking as two full-length sections one after another.
export function AdminView() {
  const [tab, setTab] = useState<AdminTab>("plan");

  return (
    <div>
      <div className="filter-pills" style={{ marginBottom: "20px" }}>
        <button
          type="button"
          className={`pill${tab === "plan" ? " active" : ""}`}
          onClick={() => setTab("plan")}
        >
          Production plan
        </button>
        <button
          type="button"
          className={`pill${tab === "users" ? " active" : ""}`}
          onClick={() => setTab("users")}
        >
          Manage users
        </button>
      </div>

      <div style={{ display: tab === "plan" ? "block" : "none" }}>
        <ProductionPlanView />
      </div>
      <div style={{ display: tab === "users" ? "block" : "none" }}>
        <ManageUsersView />
      </div>
    </div>
  );
}
