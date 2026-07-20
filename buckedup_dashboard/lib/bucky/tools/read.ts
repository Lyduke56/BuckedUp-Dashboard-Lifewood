import { tool } from "ai";
import { z } from "zod";
import { STATUS_ORDER, REVIEW_STATUS_ORDER } from "@/lib/data";
import type { IssueSeverity, IssueStatus, DeliverableDecision, UserRole } from "@/lib/types";
import { safe, DOC_STAGES, type SupabaseServerClient } from "./shared";

// "In production" / actively-worked-on stages — the 3 middle stages
// (Design, Production, In Review), excluding both Not Started (not begun)
// and Published (already finished). Shared by get_production_breakdown and
// get_ownership_breakdown so both agree on the same definition of
// "active" by construction, not by two copy-pasted filters staying in
// sync by hand.
// Explicit type annotation matters here: without it, TS narrows the Set's
// element type down to just the literals that survive the filter, which
// then makes .has() reject a full STATUS_ORDER member (e.g. "Not Started")
// as a type error at every call site below.
const ACTIVE_STAGES: Set<(typeof STATUS_ORDER)[number]> = new Set(
  STATUS_ORDER.filter((s) => s !== "Not Started" && s !== "Published"),
);

// Every tool below queries through the caller's own session client (passed
// in from the route handler, which already verified the caller is an
// admin) — so Postgres RLS applies exactly as it would if the admin had
// clicked through the UI themselves. No service-role client is used here;
// Bucky's read scope is bounded by what the signed-in session can already
// see, nothing more.
export function createBuckyReadTools(supabase: SupabaseServerClient) {
  return {
    list_products: tool({
      description:
        "List products (videos) in the content pipeline, optionally filtered by pipeline stage, category, priority, delivery type, or a name search. Use this to answer 'what's in production', 'what's published', 'what's stuck in X stage', 'what's high priority'.",
      inputSchema: z.object({
        status: z
          .enum(STATUS_ORDER as [string, ...string[]])
          .optional()
          .describe("Filter to one pipeline stage, e.g. 'Design' or 'Published'."),
        category: z.string().optional(),
        priority: z.enum(["High", "Medium", "Low"]).optional(),
        deliveryType: z.enum(["pipeline", "link"]).optional(),
        search: z.string().optional().describe("Case-insensitive substring match on product name."),
        limit: z.number().int().min(1).max(100).default(30),
      }),
      execute: ({ status, category, priority, deliveryType, search, limit }) =>
        safe(async () => {
          let query = supabase
            .from("products")
            .select(
              "id, rank, name, category, subcategory, language, status, review_status, priority, delivery_type, owner, publish_date",
            )
            .order("rank", { ascending: true })
            .limit(limit);
          if (status) query = query.eq("status", status);
          if (category) query = query.eq("category", category);
          if (priority) query = query.eq("priority", priority);
          if (deliveryType) query = query.eq("delivery_type", deliveryType);
          if (search) query = query.ilike("name", `%${search}%`);
          const { data, error } = await query;
          if (error) return { error: error.message };
          return { products: data };
        }),
    }),

    get_product: tool({
      description:
        "Get full detail on a single product by its rank number or id, including open issue count and a ready-to-use markdown table.",
      inputSchema: z.object({
        rank: z.number().int().optional(),
        id: z.string().uuid().optional(),
      }),
      execute: ({ rank, id }) =>
        safe(async () => {
          if (!rank && !id) return { error: "Provide either rank or id." };
          let query = supabase.from("products").select("*");
          query = id ? query.eq("id", id) : query.eq("rank", rank as number);
          const { data: product, error } = await query.maybeSingle();
          if (error) return { error: error.message };
          if (!product) return { error: "No product found." };
          const { count: openIssues } = await supabase
            .from("issues")
            .select("id", { count: "exact", head: true })
            .eq("product_id", product.id)
            .eq("status", "open");

          // Same pre-computed-answer pattern as get_production_breakdown —
          // this tool used to hand the model a raw row and rely on it to
          // both format AND correctly retype every field into prose;
          // confirmed live (more than once) to occasionally garble a
          // value while doing so (e.g. a real date mangled into nonsense).
          // A ready-made table the model is told to paste as-is removes
          // the retyping step entirely for the values that matter.
          const markdownTable = [
            "| Field | Value |",
            "|---|---|",
            `| Name | ${product.name} |`,
            `| Rank | ${product.rank} |`,
            `| Category | ${product.category} |`,
            `| Subcategory | ${product.subcategory} |`,
            `| Content type | ${product.content_type ?? "none"} |`,
            `| Language | ${product.language} |`,
            `| Content angle | ${product.content_angle ?? "none"} |`,
            `| Status | ${product.status} |`,
            `| Delivery type | ${product.delivery_type} |`,
            `| Priority | ${product.priority ?? "none"} |`,
            `| Owner | ${product.owner ?? "Unclaimed"} |`,
            `| Review status | ${product.review_status ?? "none"} |`,
            `| Rejection reason | ${product.rejection_reason ?? "none"} |`,
            `| Publish date | ${product.publish_date ?? "none yet"} |`,
            `| Video URL | ${product.video_url ?? "none yet"} |`,
            `| Product URL | ${product.product_url ?? "none"} |`,
            `| Catalog link | ${product.catalog_product_id ?? "none"} |`,
            `| Created | ${product.created_at} |`,
            `| Updated | ${product.updated_at} |`,
            `| Open issues | ${openIssues ?? 0} |`,
          ].join("\n");

          return { product, openIssues: openIssues ?? 0, markdownTable };
        }),
    }),

    get_daily_production: tool({
      description:
        "Get production output (videos entering each stage, videos published, broken down by category/language) for today or a range of recent days. The returned stageEntries counts stage-entry EVENTS within this date range, not current occupancy — for 'how many are in each stage right now', use get_production_breakdown instead. Use this for 'what was today's production', 'how many published this week'.",
      inputSchema: z.object({
        days: z
          .number()
          .int()
          .min(1)
          .max(90)
          .default(1)
          .describe("Number of days back from today to include. 1 = today only."),
      }),
      execute: ({ days }) =>
        safe(async () => {
          const start = new Date();
          start.setHours(0, 0, 0, 0);
          start.setDate(start.getDate() - (days - 1));
          const { data, error } = await supabase
            .from("product_status_history")
            .select("status, entered_at, products(category, language)")
            .gte("entered_at", start.toISOString());
          if (error) return { error: error.message };

          type Row = { status: string; entered_at: string; products: { category: string; language: string } | { category: string; language: string }[] | null };
          const stageEntries: Record<string, number> = {};
          const publishedByCategory: Record<string, number> = {};
          const publishedByLanguage: Record<string, number> = {};
          let published = 0;
          for (const row of (data as unknown as Row[]) ?? []) {
            stageEntries[row.status] = (stageEntries[row.status] ?? 0) + 1;
            if (row.status === "Published") {
              published += 1;
              const product = Array.isArray(row.products) ? row.products[0] : row.products;
              if (product) {
                publishedByCategory[product.category] = (publishedByCategory[product.category] ?? 0) + 1;
                publishedByLanguage[product.language] = (publishedByLanguage[product.language] ?? 0) + 1;
              }
            }
          }
          return { rangeDays: days, published, stageEntries, publishedByCategory, publishedByLanguage };
        }),
    }),

    get_analytics_summary: tool({
      description:
        "Get an overall statistics summary: stage funnel counts (stageFunnel is CUMULATIVE — count of products at or past each stage, not currently sitting in it — for current occupancy use get_production_breakdown instead), review-status distribution, rejection rate by category, and progress against the active production plan's targets, including a ready-to-use markdown table. Use for 'give me a summary/statistics'.",
      inputSchema: z.object({}),
      execute: () =>
        safe(async () => {
          const [{ data: products, error: productsError }, { data: plan }] = await Promise.all([
            supabase.from("products").select("category, language, status, review_status"),
            supabase.from("production_plans").select("*").eq("is_active", true).maybeSingle(),
          ]);
          if (productsError) return { error: productsError.message };

          const rows = products ?? [];
          const stageFunnel: Record<string, number> = {};
          for (const stage of STATUS_ORDER) {
            const stageRank = STATUS_ORDER.indexOf(stage);
            stageFunnel[stage] = rows.filter(
              (p) => STATUS_ORDER.indexOf(p.status as (typeof STATUS_ORDER)[number]) >= stageRank,
            ).length;
          }

          const reviewStatusDistribution: Record<string, number> = {};
          for (const s of REVIEW_STATUS_ORDER) reviewStatusDistribution[s] = 0;
          let otherReviewStatus = 0;
          for (const p of rows) {
            const rs = p.review_status ?? "Not Started";
            if ((REVIEW_STATUS_ORDER as readonly string[]).includes(rs)) {
              reviewStatusDistribution[rs] += 1;
            } else {
              otherReviewStatus += 1;
            }
          }

          const categoryCounts = new Map<string, { total: number; rejected: number }>();
          for (const p of rows) {
            const entry = categoryCounts.get(p.category) ?? { total: 0, rejected: 0 };
            entry.total += 1;
            if (p.review_status === "Rejected") entry.rejected += 1;
            categoryCounts.set(p.category, entry);
          }
          const rejectionRateByCategory = Object.fromEntries(
            Array.from(categoryCounts.entries()).map(([category, { total, rejected }]) => [
              category,
              total > 0 ? Math.round((rejected / total) * 1000) / 10 : 0,
            ]),
          );

          const fullReviewStatusDistribution = { ...reviewStatusDistribution, Other: otherReviewStatus };

          // Same pre-computed-answer pattern as get_production_breakdown —
          // this tool used to hand the model several raw breakdown
          // objects and rely on it to correctly retype every number into
          // prose; confirmed live (more than once, on sibling tools) that
          // a small free model can garble a value while doing so. A
          // ready-made set of tables the model is told to paste as-is
          // removes that retyping step for the numbers that matter.
          const stageFunnelTable = [
            "| Stage | At or past |",
            "|---|---|",
            ...STATUS_ORDER.map((stage) => `| ${stage} | ${stageFunnel[stage]} |`),
          ].join("\n");

          const reviewStatusTable = [
            "| Review status | Count |",
            "|---|---|",
            ...Object.entries(fullReviewStatusDistribution).map(([status, count]) => `| ${status} | ${count} |`),
          ].join("\n");

          const rejectionTable =
            Object.keys(rejectionRateByCategory).length > 0
              ? [
                  "| Category | Rejection rate |",
                  "|---|---|",
                  ...Object.entries(rejectionRateByCategory).map(([category, rate]) => `| ${category} | ${rate}% |`),
                ].join("\n")
              : "No categories with products yet.";

          const activePlan = plan
            ? {
                name: plan.name,
                totalVideoTarget: plan.total_video_target,
                deadline: plan.deadline,
                categoryTargets: plan.category_targets,
                languageTargets: plan.language_targets,
              }
            : null;

          const planTable = activePlan
            ? [
                "| Field | Value |",
                "|---|---|",
                `| Name | ${activePlan.name} |`,
                `| Total video target | ${activePlan.totalVideoTarget} |`,
                `| Deadline | ${activePlan.deadline} |`,
              ].join("\n")
            : "No active production plan.";

          const markdownTable = `**Stage funnel (cumulative — at or past each stage)**\n${stageFunnelTable}\n\n**Review status**\n${reviewStatusTable}\n\n**Rejection rate by category**\n${rejectionTable}\n\n**Active production plan**\n${planTable}`;

          return {
            totalProducts: rows.length,
            stageFunnel,
            reviewStatusDistribution: fullReviewStatusDistribution,
            rejectionRatePercentByCategory: rejectionRateByCategory,
            activePlan,
            markdownTable,
          };
        }),
    }),

    list_issues: tool({
      description: "List reported issues on products, optionally filtered by status or severity.",
      inputSchema: z.object({
        status: z.enum(["open", "resolved"]).optional(),
        severity: z.enum(["low", "medium", "high"]).optional(),
        limit: z.number().int().min(1).max(100).default(30),
      }),
      execute: ({ status, severity, limit }) =>
        safe(async () => {
          let query = supabase
            .from("issues")
            .select("id, description, severity, status, created_at, products(rank, name)")
            .order("created_at", { ascending: false })
            .limit(limit);
          if (status) query = query.eq("status", status);
          if (severity) query = query.eq("severity", severity);
          const { data, error } = await query;
          if (error) return { error: error.message };
          return { issues: data };
        }),
    }),

    // Same pre-computed-answer pattern as get_production_breakdown — "how
    // many open issues" / "which product has the most" both require real
    // counting and grouping across every issue row, exactly the
    // arithmetic the free-tier model is unreliable at doing by hand from
    // list_issues' raw rows.
    get_issue_summary: tool({
      description:
        "Get a pre-computed summary of reported issues: total open, a breakdown by severity (open only), and which products have the most open issues, including a ready-to-use markdown table. Use this for 'how many open issues', 'severity breakdown', or 'which product has the most issues' — the counting is already done for you, don't call list_issues and count by hand.",
      inputSchema: z.object({}),
      execute: () =>
        safe(async () => {
          const { data, error } = await supabase
            .from("issues")
            .select("severity, status, product_id, products(rank, name)");
          if (error) return { error: error.message };

          // Supabase's embedded-relation return shape for a to-one FK is
          // an object normally, but can come back as a single-element
          // array depending on the query planner — same defensive
          // handling as get_daily_production's Row type above.
          type Row = {
            severity: IssueSeverity;
            status: IssueStatus;
            product_id: string;
            products: { rank: number; name: string } | { rank: number; name: string }[] | null;
          };

          const bySeverity: Record<IssueSeverity, number> = { high: 0, medium: 0, low: 0 };
          let totalOpen = 0;
          let totalResolved = 0;
          const offenderCounts = new Map<string, { rank: number; name: string; openIssues: number }>();

          for (const row of (data as unknown as Row[]) ?? []) {
            if (row.status === "resolved") {
              totalResolved += 1;
              continue;
            }
            totalOpen += 1;
            bySeverity[row.severity] += 1;
            const product = Array.isArray(row.products) ? row.products[0] : row.products;
            if (product) {
              const entry = offenderCounts.get(row.product_id) ?? { rank: product.rank, name: product.name, openIssues: 0 };
              entry.openIssues += 1;
              offenderCounts.set(row.product_id, entry);
            }
          }

          const topOffenders = Array.from(offenderCounts.values())
            .sort((a, b) => b.openIssues - a.openIssues || a.rank - b.rank)
            .slice(0, 5);

          const severityTable = [
            "| Severity | Open |",
            "|---|---|",
            `| High | ${bySeverity.high} |`,
            `| Medium | ${bySeverity.medium} |`,
            `| Low | ${bySeverity.low} |`,
          ].join("\n");

          const offendersTable =
            topOffenders.length > 0
              ? [
                  "| Rank | Product | Open Issues |",
                  "|---|---|---|",
                  ...topOffenders.map((o) => `| ${o.rank} | ${o.name} | ${o.openIssues} |`),
                ].join("\n")
              : "No open issues on any product.";

          const markdownTable = `**By severity (open only)**\n${severityTable}\n\n**Top offenders**\n${offendersTable}`;

          return { totalOpen, totalResolved, bySeverity, topOffenders, markdownTable };
        }),
    }),

    list_stage_deliverables: tool({
      description: "List QA/QC stage-deliverable submissions (Storyboarding/Scripting, the two documents produced during the Design stage), optionally filtered by stage or review decision.",
      inputSchema: z.object({
        stage: z.enum(["Storyboarding", "Scripting"]).optional(),
        decision: z.enum(["pending", "accepted", "rejected"]).optional(),
        limit: z.number().int().min(1).max(100).default(30),
      }),
      execute: ({ stage, decision, limit }) =>
        safe(async () => {
          let query = supabase
            .from("stage_deliverables")
            .select("id, product_id, stage, kind, is_current, decision, decision_note, submitted_at, reviewed_at, products(rank, name)")
            .eq("is_current", true)
            .order("submitted_at", { ascending: false })
            .limit(limit);
          if (stage) query = query.eq("stage", stage);
          if (decision) query = query.eq("decision", decision);
          const { data, error } = await query;
          if (error) return { error: error.message };
          return { deliverables: data };
        }),
    }),

    // Same pre-computed-answer pattern as get_production_breakdown — a
    // stage x decision cross-tab requires real grouping across every
    // current deliverable row, not something to hand-tally from
    // list_stage_deliverables' raw rows.
    get_deliverable_summary: tool({
      description:
        "Get a pre-computed breakdown of current stage-deliverable submissions by stage and review decision (pending/accepted/rejected), including total pending and a ready-to-use markdown table. Use this for 'how many deliverables are pending', 'what's waiting on review in each stage' — don't call list_stage_deliverables and count by hand.",
      inputSchema: z.object({}),
      execute: () =>
        safe(async () => {
          const { data, error } = await supabase
            .from("stage_deliverables")
            .select("stage, decision")
            .eq("is_current", true);
          if (error) return { error: error.message };
          const rows = data ?? [];

          const byStageAndDecision = Object.fromEntries(
            DOC_STAGES.map((stage) => [stage, { pending: 0, accepted: 0, rejected: 0 }]),
          ) as Record<(typeof DOC_STAGES)[number], Record<DeliverableDecision, number>>;

          for (const row of rows) {
            const stage = row.stage as (typeof DOC_STAGES)[number];
            const decision = row.decision as DeliverableDecision;
            if (byStageAndDecision[stage]) {
              byStageAndDecision[stage][decision] = (byStageAndDecision[stage][decision] ?? 0) + 1;
            }
          }

          const totalPending = DOC_STAGES.reduce((sum, stage) => sum + byStageAndDecision[stage].pending, 0);

          const markdownTable = [
            "| Stage | Pending | Accepted | Rejected |",
            "|---|---|---|---|",
            ...DOC_STAGES.map(
              (stage) =>
                `| ${stage} | ${byStageAndDecision[stage].pending} | ${byStageAndDecision[stage].accepted} | ${byStageAndDecision[stage].rejected} |`,
            ),
          ].join("\n");

          return { byStageAndDecision, totalPending, markdownTable };
        }),
    }),

    list_users: tool({
      description: "List all user accounts and their roles (operator/lead/admin).",
      inputSchema: z.object({}),
      execute: () =>
        safe(async () => {
          const { data, error } = await supabase.from("profiles").select("id, email, role").order("email");
          if (error) return { error: error.message };
          return { users: data };
        }),
    }),

    // Pre-computes the answer server-side rather than handing the model raw
    // rows to count and format itself — the free-tier model this app runs
    // on (see route.ts) is unreliable at both arithmetic-by-hand and
    // consistent markdown formatting, and this exact query pattern ("what's
    // in production") was previously causing it to call list_products once
    // per stage (5+ calls) and still sometimes miscount. One query, real
    // numbers, and a ready-made table the model is told (see
    // systemPrompt.ts) to output as-is rather than rebuilding.
    get_production_breakdown: tool({
      description:
        "Get a live count of products at each pipeline stage, including two ready-to-use markdown tables. Use this for 'what's in production', 'how many are in each stage', or any stage-by-stage breakdown — the counting is already done for you, don't call list_products and count by hand. For a question scoped to 'in production'/'actively being worked on', output activeMarkdownTable (just the 3 active stages). For a request for the full/complete breakdown across every stage, output markdownTable (all 5 stages) instead — don't just always use one or the other.",
      inputSchema: z.object({}),
      execute: () =>
        safe(async () => {
          const { data, error } = await supabase.from("products").select("status");
          if (error) return { error: error.message };
          const rows = data ?? [];

          const byStage: Record<string, number> = {};
          for (const stage of STATUS_ORDER) byStage[stage] = 0;
          for (const row of rows) {
            byStage[row.status] = (byStage[row.status] ?? 0) + 1;
          }

          const activeStageList = STATUS_ORDER.filter((s) => ACTIVE_STAGES.has(s));
          const inProduction = activeStageList.reduce((sum, s) => sum + (byStage[s] ?? 0), 0);

          const markdownTable = [
            "| Stage | Count |",
            "|---|---|",
            ...STATUS_ORDER.map((stage) => `| ${stage} | ${byStage[stage] ?? 0} |`),
          ].join("\n");

          const activeMarkdownTable = [
            "| Stage | Count |",
            "|---|---|",
            ...activeStageList.map((stage) => `| ${stage} | ${byStage[stage] ?? 0} |`),
            `| **In production (total)** | **${inProduction}** |`,
          ].join("\n");

          return { byStage, inProduction, total: rows.length, markdownTable, activeMarkdownTable };
        }),
    }),

    // Two parallel queries (products, profiles), joined in plain
    // TypeScript via a Map, rather than an embedded profiles(...)
    // relation off products — products has exactly one FK to profiles
    // (owner_id) so an embed would technically work, but a plain
    // id->email Map keeps the join visible/debuggable here instead of
    // living inside PostgREST's embed syntax.
    //
    // Grouped by owner_id, not the `owner` display-text column — `owner`
    // is legacy, pre-auth "Sheet-era" data that the current claim/assign
    // flow (claim_product, the product edit form) never writes to;
    // owner_id is the only field that's actually kept current, and it's
    // what every DB trigger (notifications, ownership checks) already
    // keys off. A product can still show a legacy owner *name* elsewhere
    // while counting as unclaimed here — that's correct, not a bug.
    get_ownership_breakdown: tool({
      description:
        "Get a pre-computed breakdown of product ownership: total products owned and currently-active-in-pipeline count per operator, plus how many products are unclaimed, including a ready-to-use markdown table. Use this for 'how much does each operator own', 'who owns the most', or 'how many are unclaimed' — don't call list_products and count by hand.",
      inputSchema: z.object({}),
      execute: () =>
        safe(async () => {
          const [{ data: products, error: productsError }, { data: profiles, error: profilesError }] = await Promise.all([
            supabase.from("products").select("owner_id, status"),
            supabase.from("profiles").select("id, email"),
          ]);
          if (productsError) return { error: productsError.message };
          if (profilesError) return { error: profilesError.message };

          const emailById = new Map((profiles ?? []).map((p) => [p.id, p.email]));

          const counts = new Map<string, { totalOwned: number; activeInPipeline: number }>();
          let unclaimed = 0;
          let unclaimedActive = 0;
          for (const p of products ?? []) {
            const isActive = ACTIVE_STAGES.has(p.status as (typeof STATUS_ORDER)[number]);
            if (!p.owner_id) {
              unclaimed += 1;
              if (isActive) unclaimedActive += 1;
              continue;
            }
            const entry = counts.get(p.owner_id) ?? { totalOwned: 0, activeInPipeline: 0 };
            entry.totalOwned += 1;
            if (isActive) entry.activeInPipeline += 1;
            counts.set(p.owner_id, entry);
          }

          const byOperator = Array.from(counts.entries())
            // "Unknown user" is effectively unreachable — owner_id is
            // FK-constrained to profiles at all times, not just on
            // delete — kept only as a defensive fallback.
            .map(([ownerId, c]) => ({ ownerId, email: emailById.get(ownerId) ?? "Unknown user", ...c }))
            .sort((a, b) => b.totalOwned - a.totalOwned || a.email.localeCompare(b.email));

          const markdownTable = [
            "| Owner | Total Owned | Active in Pipeline |",
            "|---|---|---|",
            ...byOperator.map((o) => `| ${o.email} | ${o.totalOwned} | ${o.activeInPipeline} |`),
            `| Unclaimed | ${unclaimed} | ${unclaimedActive} |`,
          ].join("\n");

          return { byOperator, unclaimed, unclaimedActive, totalProducts: (products ?? []).length, markdownTable };
        }),
    }),

    list_catalog_products: tool({
      description:
        "List products in the BuckedUp catalog (separate from the video pipeline) — what BuckedUp sells, not what's in production. Optionally filter by name search or category. Excludes inactive items by default.",
      inputSchema: z.object({
        search: z.string().optional().describe("Case-insensitive substring match on product name."),
        category: z.string().optional(),
        includeInactive: z.boolean().default(false),
        limit: z.number().int().min(1).max(100).default(30),
      }),
      execute: ({ search, category, includeInactive, limit }) =>
        safe(async () => {
          let query = supabase
            .from("catalog_products")
            .select("id, name, category, subcategory, price, flag_status, is_active, variant_count")
            .order("name")
            .limit(limit);
          if (!includeInactive) query = query.eq("is_active", true);
          if (search) query = query.ilike("name", `%${search}%`);
          if (category) query = query.eq("category", category);
          const { data, error } = await query;
          if (error) return { error: error.message };
          return { catalogProducts: data };
        }),
    }),

    list_recent_deletions: tool({
      description:
        "List products recently deleted through Bucky that are still within their undo window and can be brought back with restore_product. Lead/admin only in practice (nothing shows up for operators).",
      inputSchema: z.object({}),
      execute: () =>
        safe(async () => {
          // Self-cleaning: the RLS delete policy only ever permits
          // deleting rows whose window has already closed, so this is
          // safe to run unconditionally before listing — mirrors
          // lib/bucky/rateLimit.ts's own clean-before-count pattern. A
          // no-op (and silently ignored) for operator callers, since only
          // lead/admin have that delete policy at all.
          await supabase
            .from("bucky_deleted_product_snapshots")
            .delete()
            .lt("expires_at", new Date().toISOString());

          const { data, error } = await supabase
            .from("bucky_deleted_product_snapshots")
            .select("id, product_name, product_rank, created_at, expires_at")
            .is("restored_at", null)
            .gt("expires_at", new Date().toISOString())
            .order("created_at", { ascending: false })
            .limit(20);
          if (error) return { error: error.message };
          return { deletions: data };
        }),
    }),
  };
}

// get_production_plan lives in its own role-gated builder, not the shared
// read tools above — the rest of the dashboard deliberately hides targets/
// pacing from operators (Planning and Analytics tabs are both absent for
// that role in TabBar.tsx; Analytics is where the daily-target-vs-actual
// chart lives), and Bucky was quietly contradicting that: any operator
// could ask this directly, and the Phase 5/11 proactive-pacing-alert
// volunteered it unprompted. Matches this codebase's standing rule that
// the tool list itself is the security boundary, not prompt wording —
// same role-gate-returns-{} pattern as the admin/operator/lead action
// builders (see admin.ts/operator.ts/lead.ts).
function buildPlanReadTools(supabase: SupabaseServerClient) {
  return {
    get_production_plan: tool({
      description:
        "Get the currently active production plan: targets, deadline, and pacing, including a ready-to-use markdown table.",
      inputSchema: z.object({}),
      execute: () =>
        safe(async () => {
          const { data, error } = await supabase
            .from("production_plans")
            .select("*")
            .eq("is_active", true)
            .maybeSingle();
          if (error) return { error: error.message };
          if (!data) return { plan: null };

          // Same pre-computed-answer pattern as get_production_breakdown —
          // this tool used to hand the model a raw row and rely on it to
          // correctly retype every field into prose; confirmed live that
          // a small free model can garble a value while doing so (a real
          // deadline date mangled into nonsense). A ready-made table the
          // model is told to paste as-is removes that retyping step for
          // the values that matter.
          const categoryTargetsStr =
            Object.entries(data.category_targets ?? {})
              .map(([category, target]) => `${category}: ${target}`)
              .join(", ") || "none";
          const languageTargetsStr =
            Object.entries(data.language_targets ?? {})
              .map(([language, target]) => `${language}: ${target}`)
              .join(", ") || "none";

          const markdownTable = [
            "| Field | Value |",
            "|---|---|",
            `| Name | ${data.name} |`,
            `| Active | ${data.is_active ? "Yes" : "No"} |`,
            `| Total video target | ${data.total_video_target} |`,
            `| Start date | ${data.start_date} |`,
            `| Deadline | ${data.deadline} |`,
            `| Language targets | ${languageTargetsStr} |`,
            `| Category targets | ${categoryTargetsStr} |`,
            `| Notes | ${data.notes ?? "none"} |`,
          ].join("\n");

          return { plan: data, markdownTable };
        }),
    }),
  };
}

export function createBuckyPlanReadTools(
  supabase: SupabaseServerClient,
  role: UserRole,
): ReturnType<typeof buildPlanReadTools> {
  if (role !== "lead" && role !== "admin") return {} as ReturnType<typeof buildPlanReadTools>;
  return buildPlanReadTools(supabase);
}
