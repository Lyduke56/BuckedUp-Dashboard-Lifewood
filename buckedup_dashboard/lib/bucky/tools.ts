import { tool } from "ai";
import { z } from "zod";
import type { createClient } from "@/lib/supabase/server";
import { STATUS_ORDER, REVIEW_STATUS_ORDER } from "@/lib/data";
import type { UserRole } from "@/lib/types";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Occasional transient network blips talking to Supabase (seen in this
// environment) throw rather than resolving to Supabase-js's normal
// { data, error } shape, which would otherwise surface as a raw
// "output-error" tool state in the chat UI. Catch those the same way as
// a reported Supabase error, so the model just sees a structured
// { error } result it can retry or explain — never a scary error bubble
// for what's usually a one-off blip.
async function safe<T>(fn: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await fn();
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Something went wrong fetching that data." };
  }
}

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
        "List products (videos) in the content pipeline, optionally filtered by pipeline stage, category, delivery type, or a name search. Use this to answer 'what's in production', 'what's published', 'what's stuck in X stage'.",
      inputSchema: z.object({
        status: z
          .enum(STATUS_ORDER as [string, ...string[]])
          .optional()
          .describe("Filter to one pipeline stage, e.g. 'Editing' or 'Published'."),
        category: z.string().optional(),
        deliveryType: z.enum(["pipeline", "link"]).optional(),
        search: z.string().optional().describe("Case-insensitive substring match on product name."),
        limit: z.number().int().min(1).max(100).default(30),
      }),
      execute: ({ status, category, deliveryType, search, limit }) =>
        safe(async () => {
          let query = supabase
            .from("products")
            .select(
              "id, rank, name, category, subcategory, language, status, review_status, delivery_type, owner, publish_date",
            )
            .order("rank", { ascending: true })
            .limit(limit);
          if (status) query = query.eq("status", status);
          if (category) query = query.eq("category", category);
          if (deliveryType) query = query.eq("delivery_type", deliveryType);
          if (search) query = query.ilike("name", `%${search}%`);
          const { data, error } = await query;
          if (error) return { error: error.message };
          return { products: data };
        }),
    }),

    get_product: tool({
      description: "Get full detail on a single product by its rank number or id, including open issue count.",
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
          return { product, openIssues: openIssues ?? 0 };
        }),
    }),

    get_daily_production: tool({
      description:
        "Get production output (videos entering each stage, videos published, broken down by category/language) for today or a range of recent days. Use for 'what was today's production', 'how many published this week'.",
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
          const byStage: Record<string, number> = {};
          const publishedByCategory: Record<string, number> = {};
          const publishedByLanguage: Record<string, number> = {};
          let published = 0;
          for (const row of (data as unknown as Row[]) ?? []) {
            byStage[row.status] = (byStage[row.status] ?? 0) + 1;
            if (row.status === "Published") {
              published += 1;
              const product = Array.isArray(row.products) ? row.products[0] : row.products;
              if (product) {
                publishedByCategory[product.category] = (publishedByCategory[product.category] ?? 0) + 1;
                publishedByLanguage[product.language] = (publishedByLanguage[product.language] ?? 0) + 1;
              }
            }
          }
          return { rangeDays: days, published, byStage, publishedByCategory, publishedByLanguage };
        }),
    }),

    get_analytics_summary: tool({
      description:
        "Get an overall statistics summary: stage funnel counts, review-status distribution, rejection rate by category, and progress against the active production plan's targets. Use for 'give me a summary/statistics'.",
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

          return {
            totalProducts: rows.length,
            stageFunnel,
            reviewStatusDistribution: { ...reviewStatusDistribution, Other: otherReviewStatus },
            rejectionRatePercentByCategory: rejectionRateByCategory,
            activePlan: plan
              ? {
                  name: plan.name,
                  totalVideoTarget: plan.total_video_target,
                  deadline: plan.deadline,
                  categoryTargets: plan.category_targets,
                  languageTargets: plan.language_targets,
                }
              : null,
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

    list_stage_deliverables: tool({
      description: "List QA/QC stage-deliverable submissions (Storyboarding/Scripting/Prompting), optionally filtered by stage or review decision.",
      inputSchema: z.object({
        stage: z.enum(["Storyboarding", "Scripting", "Prompting"]).optional(),
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

    get_production_plan: tool({
      description: "Get the currently active production plan: targets, deadline, and pacing.",
      inputSchema: z.object({}),
      execute: () =>
        safe(async () => {
          const { data, error } = await supabase
            .from("production_plans")
            .select("*")
            .eq("is_active", true)
            .maybeSingle();
          if (error) return { error: error.message };
          return { plan: data };
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
  };
}

const ROLE_SCHEMA = z.enum(["operator", "lead", "admin"]);

// Account-management actions. Each is gated by `toolApproval` (see
// app/api/bucky/chat/route.ts) — the model's tool call only *proposes*
// the action; execute() below only actually runs once the admin has
// clicked confirm in the chat UI. (Role-gating for these lives in
// createBuckyActionTools below, which wraps this builder.)
//
// create_user/delete_user deliberately call the exact same Route Handlers
// the "Manage Users" admin UI uses (forwarding the caller's session
// cookie), rather than reimplementing their logic here — that's where the
// real safety guards live (rate-limit handling, rollback-on-failure,
// self-delete/last-admin guards) and duplicating them would risk the two
// copies drifting apart. change_role has no dedicated route (the UI does
// a plain client-side update relying on RLS's admin-only policy), so it
// does the same update directly through the session-scoped client here.
function buildAdminActionTools(supabase: SupabaseServerClient, request: Request) {
  const origin = new URL(request.url).origin;
  const cookie = request.headers.get("cookie") ?? "";

  async function findUserIdByEmail(email: string): Promise<{ id: string } | { error: string }> {
    const { data, error } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();
    if (error) return { error: error.message };
    if (!data) return { error: `No account found for ${email}.` };
    return { id: data.id };
  }

  return {
    create_user: tool({
      description:
        "Create a new user account by inviting them via email, with the given role. Requires admin confirmation before it actually runs.",
      inputSchema: z.object({
        email: z.string().email(),
        role: ROLE_SCHEMA.describe("operator, lead, or admin"),
      }),
      execute: ({ email, role }) =>
        safe(async () => {
          const res = await fetch(`${origin}/api/admin/create-user`, {
            method: "POST",
            headers: { "Content-Type": "application/json", cookie },
            body: JSON.stringify({ email, role }),
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) return { error: body.error ?? `Failed to create account (status ${res.status}).` };
          return { created: body };
        }),
    }),

    delete_user: tool({
      description: "Delete a user account by email. Requires admin confirmation before it actually runs.",
      inputSchema: z.object({ email: z.string().email() }),
      execute: ({ email }) =>
        safe(async () => {
          const found = await findUserIdByEmail(email);
          if ("error" in found) return found;
          const res = await fetch(`${origin}/api/admin/users/${found.id}`, {
            method: "DELETE",
            headers: { cookie },
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            return { error: body.error ?? `Failed to delete account (status ${res.status}).` };
          }
          return { deleted: email };
        }),
    }),

    change_role: tool({
      description: "Change an existing user's role by email. Requires admin confirmation before it actually runs.",
      inputSchema: z.object({
        email: z.string().email(),
        role: ROLE_SCHEMA.describe("operator, lead, or admin"),
      }),
      execute: ({ email, role }) =>
        safe(async () => {
          const found = await findUserIdByEmail(email);
          if ("error" in found) return found;
          const { error } = await supabase.from("profiles").update({ role }).eq("id", found.id);
          if (error) return { error: error.message };
          return { updated: email, role };
        }),
    }),
  };
}

// Bucky is now reachable by lead/operator too (see route.ts), but the
// tools above stay admin-exclusive — they're account governance, not
// pipeline work. Returning {} for non-admins means the model is never
// even given a schema for them, so it can't attempt to call one no matter
// what it's asked — the tool map itself is the security boundary, not
// prompt wording. (The type assertion below is compile-time only: the
// runtime value genuinely has no keys for non-admins, which is what the
// AI SDK actually iterates over — TS just can't express "same shape, but
// conditionally absent" without either this or losing the literal key
// names streamText's toolApproval needs.)
export function createBuckyActionTools(
  supabase: SupabaseServerClient,
  request: Request,
  role: UserRole,
): ReturnType<typeof buildAdminActionTools> {
  if (role !== "admin") return {} as ReturnType<typeof buildAdminActionTools>;
  return buildAdminActionTools(supabase, request);
}

// Shared by every product-locating tool below (operator's and lead's) —
// mirrors get_product's same-shaped params so the model can reuse whichever
// it already has from a prior read-tool call.
const PRODUCT_LOCATOR_SHAPE = {
  rank: z.number().int().optional().describe("The product's rank number."),
  id: z.string().uuid().optional().describe("The product's id, if already known."),
};

// Shared by every tool below that locates a product by rank or id. Hoisted
// to module scope (rather than a per-builder closure) since both the
// operator and lead action-tool builders need it.
async function resolveProductId(
  supabase: SupabaseServerClient,
  rank: number | undefined,
  id: string | undefined,
): Promise<{ id: string } | { error: string }> {
  if (!rank && !id) return { error: "Provide either rank or id." };
  if (id) return { id };
  const { data, error } = await supabase.from("products").select("id").eq("rank", rank as number).maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "No product found." };
  return { id: data.id };
}

// Operator's own work-execution tools. None of these require toolApproval
// (see route.ts) — they're the operator doing their own routine, self-scoped
// job, exactly as frictionless as the equivalent buttons in
// VideoLibraryView/ProductFormModal/VideoVersionsPanel today. Every write
// goes through the caller's own session client (RLS-enforced), same as the
// read tools — no service-role client here either.
function buildOperatorActionTools(supabase: SupabaseServerClient, userId: string) {
  return {
    report_issue: tool({
      description: "Report a new issue against a product. Runs immediately, no confirmation needed.",
      inputSchema: z.object({
        rank: z.number().int().describe("The product's rank number."),
        description: z.string().min(1),
        severity: z.enum(["low", "medium", "high"]).default("medium"),
      }),
      execute: ({ rank, description, severity }) =>
        safe(async () => {
          const { data: product, error: productError } = await supabase
            .from("products")
            .select("id")
            .eq("rank", rank)
            .maybeSingle();
          if (productError) return { error: productError.message };
          if (!product) return { error: `No product found with rank ${rank}.` };
          const { error } = await supabase.from("issues").insert({
            product_id: product.id,
            description,
            severity,
          });
          if (error) return { error: error.message };
          return { reported: true, rank, severity };
        }),
    }),

    resolve_issue: tool({
      description:
        "Mark an issue as resolved by its id. Call list_issues first if you don't already have the id from this conversation. Runs immediately, no confirmation needed.",
      inputSchema: z.object({ issueId: z.string().uuid() }),
      execute: ({ issueId }) =>
        safe(async () => {
          const { data, error } = await supabase
            .from("issues")
            .update({ status: "resolved" })
            .eq("id", issueId)
            .select("id")
            .maybeSingle();
          if (error) return { error: error.message };
          if (!data) return { error: "No issue found with that id." };
          return { resolved: true };
        }),
    }),

    claim_product: tool({
      description:
        "Claim ownership of a product that isn't currently owned by anyone. Runs immediately, no confirmation needed.",
      inputSchema: z.object(PRODUCT_LOCATOR_SHAPE),
      execute: ({ rank, id }) =>
        safe(async () => {
          if (!rank && !id) return { error: "Provide either rank or id." };
          let query = supabase.from("products").select("id, name, owner_id, owner");
          query = id ? query.eq("id", id) : query.eq("rank", rank as number);
          const { data: product, error } = await query.maybeSingle();
          if (error) return { error: error.message };
          if (!product) return { error: "No product found." };
          // The real UI only shows a "claim" button when a product is
          // unowned — the DB doesn't enforce that (operators can change
          // owner_id freely per the update-permissions trigger), so this
          // check has to happen here or an operator could silently steal
          // someone else's claimed assignment with no error at all.
          if (product.owner_id && product.owner_id !== userId) {
            return {
              error: `${product.name} is already owned by ${product.owner ?? "someone else"} — ask a lead to reassign it.`,
            };
          }
          const { error: updateError } = await supabase
            .from("products")
            .update({ owner_id: userId })
            .eq("id", product.id);
          if (updateError) return { error: updateError.message };
          return { claimed: product.name };
        }),
    }),

    submit_deliverable: tool({
      description:
        "Submit a text deliverable for a product you own, for whichever of Storyboarding/Scripting/Prompting it's currently in. File attachments aren't supported through chat — use the dashboard UI for those. Runs immediately, no confirmation needed.",
      inputSchema: z.object({
        ...PRODUCT_LOCATOR_SHAPE,
        textContent: z.string().min(1),
      }),
      execute: ({ rank, id, textContent }) =>
        safe(async () => {
          if (!rank && !id) return { error: "Provide either rank or id." };
          let query = supabase.from("products").select("id, name, status, owner_id");
          query = id ? query.eq("id", id) : query.eq("rank", rank as number);
          const { data: product, error } = await query.maybeSingle();
          if (error) return { error: error.message };
          if (!product) return { error: "No product found." };
          if (product.owner_id !== userId) {
            return { error: `You can only submit a deliverable for a product you own — ${product.name} isn't yours.` };
          }
          if (!["Storyboarding", "Scripting", "Prompting"].includes(product.status)) {
            return {
              error: `${product.name} is currently in "${product.status}" — deliverables can only be submitted during Storyboarding, Scripting, or Prompting.`,
            };
          }
          const { error: insertError } = await supabase.from("stage_deliverables").insert({
            product_id: product.id,
            stage: product.status,
            kind: "text",
            text_content: textContent.trim(),
            submitted_by: userId,
          });
          if (insertError) return { error: insertError.message };
          return { submitted: true, product: product.name, stage: product.status };
        }),
    }),

    submit_video_for_review: tool({
      description:
        "Submit a product's video for review, moving it from Editing to In Review. The server checks ownership and stage automatically and returns a clear error if either doesn't hold — don't try to pre-verify ownership yourself from a product's owner_id (you can't reliably tell if a raw id is 'you'), just call this directly when asked. Runs immediately, no confirmation needed.",
      inputSchema: z.object(PRODUCT_LOCATOR_SHAPE),
      execute: ({ rank, id }) =>
        safe(async () => {
          const resolved = await resolveProductId(supabase, rank, id);
          if ("error" in resolved) return resolved;
          const { error } = await supabase.rpc("submit_video_for_review", { p_product_id: resolved.id });
          if (error) return { error: error.message };
          return { submittedForReview: true };
        }),
    }),

    set_video_version: tool({
      description:
        "Set a new current video version for a product from a URL (no file upload through chat — use the dashboard UI to upload a file). Updates the product's video URL. Runs immediately, no confirmation needed.",
      inputSchema: z.object({
        ...PRODUCT_LOCATOR_SHAPE,
        videoUrl: z.string().url(),
        note: z.string().optional(),
      }),
      execute: ({ rank, id, videoUrl, note }) =>
        safe(async () => {
          const resolved = await resolveProductId(supabase, rank, id);
          if ("error" in resolved) return resolved;
          const { error } = await supabase.rpc("set_current_video_version", {
            p_product_id: resolved.id,
            p_video_url: videoUrl,
            p_note: note ?? null,
          });
          if (error) return { error: error.message };
          return { videoVersionSet: true };
        }),
    }),
  };
}

// Same role-gate-returns-{} pattern as createBuckyActionTools above — the
// model gets no schema for these six tools unless the caller is an
// operator, so it can't attempt one regardless of what it's asked.
export function createBuckyOperatorActionTools(
  supabase: SupabaseServerClient,
  role: UserRole,
  userId: string,
): ReturnType<typeof buildOperatorActionTools> {
  if (role !== "operator") return {} as ReturnType<typeof buildOperatorActionTools>;
  return buildOperatorActionTools(supabase, userId);
}

const DOC_STAGES = ["Storyboarding", "Scripting", "Prompting"] as const;

// Lead's pipeline-management tools. All three require toolApproval (see
// route.ts) — team-visible workflow changes, not self-scoped routine work
// like the operator tools above. Every write goes through the caller's own
// session client (RLS-enforced) — lead's real DB permissions are the actual
// authority here, this just gives chat access to what the UI already
// allows. This builder grows across future sub-phases (product/catalog CRUD,
// plan edits) the same way buildOperatorActionTools did — one role, one
// builder, tools added incrementally.
function buildLeadActionTools(supabase: SupabaseServerClient) {
  return {
    move_product_stage: tool({
      description:
        "Directly set a product's pipeline stage to any of the 7 stages, bypassing normal review. Prefer review_deliverable or review_video when actually reviewing a submission — use this for corrections or exceptions. Requires confirmation before it runs.",
      inputSchema: z.object({
        ...PRODUCT_LOCATOR_SHAPE,
        newStatus: z.enum(STATUS_ORDER as [string, ...string[]]),
      }),
      execute: ({ rank, id, newStatus }) =>
        safe(async () => {
          if (!rank && !id) return { error: "Provide either rank or id." };
          let query = supabase.from("products").select("id, name, status");
          query = id ? query.eq("id", id) : query.eq("rank", rank as number);
          const { data: product, error } = await query.maybeSingle();
          if (error) return { error: error.message };
          if (!product) return { error: "No product found." };
          if (product.status === newStatus) {
            return { noop: true, message: `${product.name} is already in ${newStatus}.` };
          }
          const { error: updateError } = await supabase
            .from("products")
            .update({ status: newStatus })
            .eq("id", product.id);
          if (updateError) return { error: updateError.message };
          return { moved: true, product: product.name, from: product.status, to: newStatus };
        }),
    }),

    review_deliverable: tool({
      description:
        "Accept or reject the current pending deliverable for a product's document stage (Storyboarding/Scripting/Prompting). Accepting advances the product to the next stage. A note is required when rejecting. Requires confirmation before it runs.",
      inputSchema: z.object({
        ...PRODUCT_LOCATOR_SHAPE,
        decision: z.enum(["accepted", "rejected"]),
        note: z.string().optional(),
      }),
      execute: ({ rank, id, decision, note }) =>
        safe(async () => {
          if (!rank && !id) return { error: "Provide either rank or id." };
          let query = supabase.from("products").select("id, name, status");
          query = id ? query.eq("id", id) : query.eq("rank", rank as number);
          const { data: product, error } = await query.maybeSingle();
          if (error) return { error: error.message };
          if (!product) return { error: "No product found." };
          if (!DOC_STAGES.includes(product.status as (typeof DOC_STAGES)[number])) {
            return {
              error: `${product.name} is currently in "${product.status}" — deliverable review only applies to Storyboarding, Scripting, or Prompting.`,
            };
          }
          if (decision === "rejected" && !note) {
            return { error: "A note is required when rejecting a deliverable." };
          }
          const { data: deliverable, error: deliverableError } = await supabase
            .from("stage_deliverables")
            .select("id")
            .eq("product_id", product.id)
            .eq("stage", product.status)
            .eq("is_current", true)
            .maybeSingle();
          if (deliverableError) return { error: deliverableError.message };
          if (!deliverable) {
            return { error: `No pending deliverable found for ${product.name} in ${product.status}.` };
          }
          const { error: rpcError } = await supabase.rpc("review_stage_deliverable", {
            p_deliverable_id: deliverable.id,
            p_decision: decision,
            p_note: note ?? null,
          });
          if (rpcError) return { error: rpcError.message };
          return { reviewed: true, product: product.name, stage: product.status, decision };
        }),
    }),

    review_video: tool({
      description:
        "Accept or reject a product's submitted video. Accepting PUBLISHES it (sets its stage to Published) — this is the single most consequential action available. Only works for a product currently In Review. A note is required when rejecting. Requires confirmation before it runs.",
      inputSchema: z.object({
        ...PRODUCT_LOCATOR_SHAPE,
        decision: z.enum(["accepted", "rejected"]),
        note: z.string().optional(),
      }),
      execute: ({ rank, id, decision, note }) =>
        safe(async () => {
          if (!rank && !id) return { error: "Provide either rank or id." };
          let query = supabase.from("products").select("id, name, status");
          query = id ? query.eq("id", id) : query.eq("rank", rank as number);
          const { data: product, error } = await query.maybeSingle();
          if (error) return { error: error.message };
          if (!product) return { error: "No product found." };
          if (product.status !== "In Review") {
            return { error: `${product.name} hasn't been submitted for review yet (currently "${product.status}").` };
          }
          if (decision === "rejected" && !note) {
            return { error: "A note is required when rejecting a video." };
          }
          const { error: updateError } = await supabase
            .from("products")
            .update(
              decision === "accepted"
                ? { review_status: "Accepted", rejection_reason: null, status: "Published" }
                : { review_status: "Rejected", rejection_reason: note, status: "Editing" },
            )
            .eq("id", product.id);
          if (updateError) return { error: updateError.message };
          return { reviewed: true, product: product.name, decision };
        }),
    }),

    create_product: tool({
      description:
        "Create a new product in the video pipeline. Either source it from a BuckedUp catalog item (catalogProductId — its name/category/subcategory/productUrl are used automatically, don't also pass conflicting values) or provide name/category/subcategory directly. Rank is auto-assigned if omitted. Set deliveryType to 'link' with a videoUrl for an external asset that's immediately Published, bypassing the pipeline. Requires confirmation before it runs.",
      inputSchema: z.object({
        catalogProductId: z
          .string()
          .uuid()
          .optional()
          .describe("Source from this BuckedUp catalog item — its name/category/subcategory/productUrl are used automatically."),
        name: z.string().optional().describe("Required unless catalogProductId is given."),
        category: z.string().optional().describe("Required unless catalogProductId is given."),
        subcategory: z.string().optional().describe("Required unless catalogProductId is given."),
        language: z.string().default("English"),
        contentType: z.string().optional(),
        contentAngle: z.string().optional(),
        productUrl: z.string().optional().describe("Ignored if catalogProductId is given."),
        ownerEmail: z.string().email().optional(),
        publishDate: z.string().optional().describe("YYYY-MM-DD"),
        deliveryType: z.enum(["pipeline", "link"]).default("pipeline"),
        videoUrl: z.string().url().optional().describe("Required when deliveryType is 'link'."),
        rank: z.number().int().optional().describe("Defaults to the next available rank if omitted."),
      }),
      execute: (params) =>
        safe(async () => {
          const { catalogProductId, ownerEmail, deliveryType, videoUrl, rank, publishDate, language, contentType, contentAngle } =
            params;
          let { name, category, subcategory, productUrl } = params;

          if (!catalogProductId && (!name || !category || !subcategory)) {
            return { error: "Provide catalogProductId, or name, category, and subcategory directly." };
          }
          if (deliveryType === "link" && !videoUrl) {
            return { error: "videoUrl is required when deliveryType is 'link'." };
          }

          if (catalogProductId) {
            const { data: catalogProduct, error: catalogError } = await supabase
              .from("catalog_products")
              .select("name, category, subcategory, product_url")
              .eq("id", catalogProductId)
              .maybeSingle();
            if (catalogError) return { error: catalogError.message };
            if (!catalogProduct) return { error: "No catalog product found with that id." };
            name = catalogProduct.name;
            category = catalogProduct.category;
            subcategory = catalogProduct.subcategory;
            productUrl = catalogProduct.product_url ?? undefined;
          }

          let ownerId: string | undefined;
          let ownerDisplay: string | undefined;
          if (ownerEmail) {
            const { data: ownerProfile, error: ownerError } = await supabase
              .from("profiles")
              .select("id, email")
              .eq("email", ownerEmail)
              .maybeSingle();
            if (ownerError) return { error: ownerError.message };
            if (!ownerProfile) return { error: `No account found for ${ownerEmail}.` };
            ownerId = ownerProfile.id;
            ownerDisplay = ownerProfile.email;
          }

          let finalRank = rank;
          if (!finalRank) {
            const { data: maxRankRow, error: rankError } = await supabase
              .from("products")
              .select("rank")
              .order("rank", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (rankError) return { error: rankError.message };
            finalRank = (maxRankRow?.rank ?? 0) + 1;
          }

          const status = deliveryType === "link" ? "Published" : "Not Started";

          const { data: created, error: insertError } = await supabase
            .from("products")
            .insert({
              rank: finalRank,
              name,
              category,
              subcategory,
              content_type: contentType ?? null,
              language,
              product_url: productUrl ?? null,
              content_angle: contentAngle ?? null,
              owner_id: ownerId ?? null,
              owner: ownerDisplay ?? null,
              publish_date: publishDate ?? null,
              status,
              delivery_type: deliveryType,
              video_url: deliveryType === "link" ? videoUrl : null,
              catalog_product_id: catalogProductId ?? null,
            })
            .select("id, rank, name")
            .single();
          if (insertError) return { error: insertError.message };
          return { created: true, product: created };
        }),
    }),

    delete_product: tool({
      description:
        "Delete a product. This is irreversible and cascades to its issues, deliverables, video versions, and status history. Requires confirmation before it runs.",
      inputSchema: z.object(PRODUCT_LOCATOR_SHAPE),
      execute: ({ rank, id }) =>
        safe(async () => {
          if (!rank && !id) return { error: "Provide either rank or id." };
          let query = supabase.from("products").select("id, name");
          query = id ? query.eq("id", id) : query.eq("rank", rank as number);
          const { data: product, error } = await query.maybeSingle();
          if (error) return { error: error.message };
          if (!product) return { error: "No product found." };
          const { error: deleteError } = await supabase.from("products").delete().eq("id", product.id);
          if (deleteError) return { error: deleteError.message };
          return { deleted: true, product: product.name };
        }),
    }),
  };
}

// Same role-gate-returns-{} pattern as the operator/admin builders above.
export function createBuckyLeadActionTools(
  supabase: SupabaseServerClient,
  role: UserRole,
): ReturnType<typeof buildLeadActionTools> {
  if (role !== "lead") return {} as ReturnType<typeof buildLeadActionTools>;
  return buildLeadActionTools(supabase);
}
