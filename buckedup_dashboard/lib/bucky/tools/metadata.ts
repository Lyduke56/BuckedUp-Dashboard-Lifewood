import type { createBuckyReadTools, createBuckyPlanReadTools } from "./read";
import type { createBuckyActionTools } from "./admin";
import type { createBuckyOperatorActionTools } from "./operator";
import type { createBuckyLeadActionTools } from "./lead";

export type AnyBuckyToolName =
  | keyof ReturnType<typeof createBuckyReadTools>
  | keyof ReturnType<typeof createBuckyPlanReadTools>
  | keyof ReturnType<typeof createBuckyActionTools>
  | keyof ReturnType<typeof createBuckyOperatorActionTools>
  | keyof ReturnType<typeof createBuckyLeadActionTools>;

export type BuckyToolAuditMeta = {
  /** Writes to the DB / calls a mutating route — gates whether this tool
   *  gets an audit row at all (see route.ts's onToolExecutionEnd). */
  mutating: boolean;
  approval: "user-approval" | "none";
};

// Single source of truth for two things that used to live in two separate,
// hand-maintained places: which tools need a user-approval confirm card
// (previously a literal object in route.ts, kept in sync with tools.ts by
// hand), and which tools are worth writing an audit-log row for. Every key
// of AnyBuckyToolName is REQUIRED here — TypeScript refuses to compile if a
// new tool gets added to any builder in read.ts/admin.ts/operator.ts/lead.ts
// without a matching entry below, so "forgot to gate a new mutating tool
// behind approval" becomes a compile error instead of a silent gap.
export const BUCKY_TOOL_METADATA: Record<AnyBuckyToolName, BuckyToolAuditMeta> = {
  // reads — never mutate, never gated, never audit-logged (see route.ts)
  list_products: { mutating: false, approval: "none" },
  get_product: { mutating: false, approval: "none" },
  get_daily_production: { mutating: false, approval: "none" },
  get_analytics_summary: { mutating: false, approval: "none" },
  list_issues: { mutating: false, approval: "none" },
  list_stage_deliverables: { mutating: false, approval: "none" },
  get_production_plan: { mutating: false, approval: "none" },
  list_users: { mutating: false, approval: "none" },
  get_production_breakdown: { mutating: false, approval: "none" },
  list_catalog_products: { mutating: false, approval: "none" },
  get_issue_summary: { mutating: false, approval: "none" },
  get_deliverable_summary: { mutating: false, approval: "none" },
  get_ownership_breakdown: { mutating: false, approval: "none" },
  list_recent_deletions: { mutating: false, approval: "none" },
  // admin (governance)
  create_user: { mutating: true, approval: "user-approval" },
  delete_user: { mutating: true, approval: "user-approval" },
  change_role: { mutating: true, approval: "user-approval" },
  // shared issue tools (operator + lead) — frictionless, matches the real
  // UI's own report/resolve buttons regardless of who's clicking them
  report_issue: { mutating: true, approval: "none" },
  resolve_issue: { mutating: true, approval: "none" },
  // operator's own self-scoped work
  claim_product: { mutating: true, approval: "none" },
  unclaim_product: { mutating: true, approval: "none" },
  submit_deliverable: { mutating: true, approval: "none" },
  submit_video_for_review: { mutating: true, approval: "none" },
  set_video_version: { mutating: true, approval: "none" },
  // lead's pipeline/catalog/plan management — team-visible, confirm-gated
  move_product_stage: { mutating: true, approval: "user-approval" },
  review_deliverable: { mutating: true, approval: "user-approval" },
  review_video: { mutating: true, approval: "user-approval" },
  create_product: { mutating: true, approval: "user-approval" },
  delete_product: { mutating: true, approval: "user-approval" },
  update_production_plan: { mutating: true, approval: "user-approval" },
  create_or_update_catalog_product: { mutating: true, approval: "user-approval" },
  delete_catalog_product: { mutating: true, approval: "user-approval" },
  // restoring is safe/additive — same risk tier as the operator
  // work-execution tools above, no confirm step needed
  restore_product: { mutating: true, approval: "none" },
  restore_catalog_product: { mutating: true, approval: "none" },
};

// Derived, not hand-written — route.ts passes this straight to streamText's
// toolApproval option, so there's only ever one place (BUCKY_TOOL_METADATA
// above) to update when a tool's approval requirement changes.
export const BUCKY_TOOL_APPROVAL: Partial<Record<AnyBuckyToolName, "user-approval">> = Object.fromEntries(
  Object.entries(BUCKY_TOOL_METADATA)
    .filter(([, meta]) => meta.approval === "user-approval")
    .map(([name]) => [name, "user-approval" as const]),
);
