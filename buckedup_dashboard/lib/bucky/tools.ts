import { tool } from "ai";
import { z } from "zod";
import type { createClient } from "@/lib/supabase/server";
import { STATUS_ORDER, REVIEW_STATUS_ORDER } from "@/lib/data";

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
