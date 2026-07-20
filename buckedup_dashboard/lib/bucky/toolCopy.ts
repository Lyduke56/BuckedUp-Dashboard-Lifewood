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
        : `Reject ${product}'s video back to Production?`;
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

// Pulls a real product/user name out of a tool's own output, when one's
// there — e.g. claim_product returns { claimed: "BuckedUp Florida Beach
// Towel", ... }, not just the rank the model happened to call it with.
// Tries each of the given output keys in order and returns the first
// non-empty string found, else null.
function nameFromOutput(output: unknown, ...keys: string[]): string | null {
  if (!output || typeof output !== "object") return null;
  const obj = output as Record<string, unknown>;
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.length > 0) return value;
    // A few tools nest it one level down (get_product's `product.name`,
    // create_product's `product.name` from the inserted row).
    if (value && typeof value === "object" && typeof (value as Record<string, unknown>).name === "string") {
      return (value as Record<string, unknown>).name as string;
    }
  }
  return null;
}

// Human-readable summary of a tool's completed result, shown as the
// <summary> of the collapsible output-available block (and reused,
// pre-completion, as the "what Bucky's doing right now" line once its
// input is fully formed — see the input-available branch in
// BuckyWidget.tsx, which calls this with output omitted since it doesn't
// exist yet). Mutation tools that don't require approval (operator's
// work-execution tools, see lib/bucky/tools/operator.ts) get a past-tense
// summary since "Looked up submit_deliverable" reads oddly for something
// that just *did* something rather than fetched data; read tools get a
// plain-language description of what was checked, instead of the raw
// function name.
//
// `output` is optional and, when given, is preferred over `input` for
// naming the product/item involved — the model calls most of these tools
// with just a bare rank or id (whatever it resolved internally, possibly
// from an earlier lookup earlier in the same turn), so a label built from
// input alone can only ever show "#3", even when the user asked about it
// by name and the tool's own result already has that name sitting right
// there. Falls back to the rank-based phrasing when no name is available
// in output (e.g. the input-available state, or a tool whose output
// genuinely has no name field) — never left blank.
export function describeToolResult(toolName: string, input: unknown, output?: unknown): string {
  const params = (input ?? {}) as Record<string, unknown>;
  const rankProduct = typeof params.rank === "number" ? `#${params.rank}` : "a product";
  const named = (...keys: string[]) => {
    const name = nameFromOutput(output, ...keys);
    return name ? `"${name}"` : rankProduct;
  };
  switch (toolName) {
    case "list_products":
      return "Looked up the product list";
    case "get_product": {
      const name = nameFromOutput(output, "product");
      if (name) return `Looked up ${name}`;
      return typeof params.rank === "number" ? `Looked up product #${params.rank}` : "Looked up that product's details";
    }
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
      return `Claimed ${named("claimed")}`;
    case "unclaim_product":
      return `Unclaimed ${named("unclaimed")}`;
    case "submit_deliverable":
      return `Submitted a deliverable for ${named("product")}`;
    case "submit_video_for_review":
      return `Submitted ${named("product")} for review`;
    case "set_video_version":
      return `Set a new video version for ${named("product")}`;
    case "create_user":
      return `Created ${withArticle(typeof params.role === "string" ? params.role : "user")} account`;
    case "delete_user":
      return "Deleted a user account";
    case "change_role":
      return `Changed a user's role to ${params.role}`;
    case "move_product_stage":
      return `Moved ${named("product")} to ${typeof params.newStatus === "string" ? params.newStatus : "a new stage"}`;
    case "review_deliverable":
      return params.decision === "accepted"
        ? `Accepted the deliverable for ${named("product")}`
        : `Rejected the deliverable for ${named("product")}`;
    case "review_video":
      return params.decision === "accepted" ? `Published ${named("product")}` : `Rejected ${named("product")}'s video back to Production`;
    case "create_product": {
      const name = nameFromOutput(output, "product") ?? (typeof params.name === "string" ? params.name : null);
      return name ? `Created "${name}"` : "Created a new product";
    }
    case "delete_product":
      return `Deleted ${named("product")}`;
    case "restore_product":
      return `Restored ${named("product")}`;
    case "update_production_plan":
      return "Updated the production plan";
    case "create_or_update_catalog_product":
      return params.id ? `Updated ${named("product")}` : `Created ${named("product")}`;
    case "delete_catalog_product":
      return `Deleted ${named("product")}`;
    case "restore_catalog_product":
      return `Restored ${named("product")}`;
    default:
      return `Looked up ${toolName}`;
  }
}
