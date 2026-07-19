// Human-readable summaries of Bucky action-tool calls, shared between the
// live widget (BuckyWidget.tsx, confirm cards + completed-result summaries)
// and the read-only admin transcript viewer (BuckyTranscriptModal.tsx).
function withArticle(word: unknown): string {
  const w = String(word);
  return `${/^[aeiou]/i.test(w) ? "an" : "a"} ${w}`;
}

// Human-readable summary of a proposed action-tool call, shown in the
// confirm/cancel card before it runs (and, in the transcript viewer, as a
// record of what was proposed). Falls back to the raw tool name for
// anything not explicitly described here (e.g. if a new action tool gets
// added later without updating this).
export function describeAction(toolName: string, input: unknown): string {
  const params = (input ?? {}) as Record<string, unknown>;
  const product = params.rank != null ? `#${params.rank}` : String(params.id ?? "that product");
  switch (toolName) {
    case "create_user":
      return `Create ${withArticle(params.role)} account for ${params.email}?`;
    case "delete_user":
      return `Delete ${params.email}'s account? This can't be undone.`;
    case "change_role":
      return `Change ${params.email}'s role to ${params.role}?`;
    case "move_product_stage":
      return `Move ${product} to ${params.newStatus}?`;
    case "review_deliverable":
      return params.decision === "accepted"
        ? `Accept the deliverable for ${product}?`
        : `Reject the deliverable for ${product}?`;
    case "review_video":
      return params.decision === "accepted"
        ? `Accept and PUBLISH ${product}? This makes it publicly live.`
        : `Reject ${product}'s video back to Editing?`;
    case "create_product":
      return typeof params.name === "string"
        ? `Create a new product "${params.name}"?`
        : params.catalogProductId
          ? "Create a new product from the selected catalog item?"
          : "Create a new product?";
    case "delete_product":
      return `Delete ${product}? This can't be undone and removes all its issues, deliverables, and version history.`;
    case "update_production_plan":
      return `Update the production plan${typeof params.name === "string" ? ` "${params.name}"` : ""}?`;
    case "create_or_update_catalog_product":
      return `${params.id ? "Update" : "Create"} the catalog product${typeof params.name === "string" ? ` "${params.name}"` : ""}?`;
    case "delete_catalog_product":
      return `Delete the catalog product${typeof params.name === "string" ? ` "${params.name}"` : ""}? This can't be undone — any linked video stays, just unlinked.`;
    default:
      return `Run ${toolName}?`;
  }
}

// Human-readable summary of a tool's completed result, shown as the
// <summary> of the collapsible output-available block (and reused,
// pre-completion, as the "what Bucky's doing right now" line once its
// input is fully formed — see the input-available branch in
// BuckyWidget.tsx). Mutation tools that don't require approval (operator's
// work-execution tools, see lib/bucky/tools/operator.ts) get a past-tense
// summary since "Looked up submit_deliverable" reads oddly for something
// that just *did* something rather than fetched data; read tools get a
// plain-language description of what was checked, instead of the raw
// function name.
export function describeToolResult(toolName: string, input: unknown): string {
  const params = (input ?? {}) as Record<string, unknown>;
  const product = typeof params.rank === "number" ? `#${params.rank}` : "a product";
  switch (toolName) {
    case "list_products":
      return "Looked up the product list";
    case "get_product":
      return typeof params.rank === "number" ? `Looked up product #${params.rank}` : "Looked up that product's details";
    case "get_daily_production":
      return "Checked recent production output";
    case "get_analytics_summary":
      return "Checked the analytics summary";
    case "list_issues":
      return "Looked up reported issues";
    case "list_stage_deliverables":
      return "Looked up submitted deliverables";
    case "get_production_plan":
      return "Checked the production plan";
    case "list_users":
      return "Looked up the team list";
    case "get_production_breakdown":
      return "Checked what's currently in production";
    case "list_catalog_products":
      return "Looked up the catalog";
    case "get_issue_summary":
      return "Checked open issues";
    case "get_deliverable_summary":
      return "Checked pending deliverables";
    case "get_ownership_breakdown":
      return "Checked who owns what";
    case "list_recent_deletions":
      return "Checked what's recoverable";
    case "report_issue": {
      const severity = typeof params.severity === "string" ? params.severity : "medium";
      return `Reported ${withArticle(severity)} issue on #${params.rank}`;
    }
    case "resolve_issue":
      return "Resolved an issue";
    case "claim_product":
      return `Claimed ${product}`;
    case "submit_deliverable":
      return `Submitted a deliverable for ${product}`;
    case "submit_video_for_review":
      return `Submitted ${product} for review`;
    case "set_video_version":
      return `Set a new video version for ${product}`;
    case "create_user":
      return `Created ${withArticle(typeof params.role === "string" ? params.role : "user")} account`;
    case "delete_user":
      return "Deleted a user account";
    case "change_role":
      return `Changed a user's role to ${params.role}`;
    case "move_product_stage":
      return `Moved ${product} to ${typeof params.newStatus === "string" ? params.newStatus : "a new stage"}`;
    case "review_deliverable":
      return params.decision === "accepted"
        ? `Accepted the deliverable for ${product}`
        : `Rejected the deliverable for ${product}`;
    case "review_video":
      return params.decision === "accepted" ? `Published ${product}` : `Rejected ${product}'s video back to Editing`;
    case "create_product":
      return typeof params.name === "string" ? `Created "${params.name}"` : "Created a new product";
    case "delete_product":
      return `Deleted ${product}`;
    case "update_production_plan":
      return "Updated the production plan";
    case "create_or_update_catalog_product":
      return params.id ? "Updated a catalog product" : "Created a catalog product";
    case "delete_catalog_product":
      return "Deleted a catalog product";
    default:
      return `Looked up ${toolName}`;
  }
}
