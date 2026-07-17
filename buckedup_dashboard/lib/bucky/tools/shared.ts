import { z } from "zod";
import type { createClient } from "@/lib/supabase/server";
import { tool } from "ai";

export type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Occasional transient network blips talking to Supabase (seen in this
// environment) throw rather than resolving to Supabase-js's normal
// { data, error } shape, which would otherwise surface as a raw
// "output-error" tool state in the chat UI. Catch those the same way as
// a reported Supabase error, so the model just sees a structured
// { error } result it can retry or explain — never a scary error bubble
// for what's usually a one-off blip.
export async function safe<T>(fn: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await fn();
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Something went wrong fetching that data." };
  }
}

// ILIKE treats "%" (any sequence) and "_" (any single character) as
// wildcards, not literal text. Fine for tools that intentionally want
// substring search (list_products/list_catalog_products' `search` param,
// wrapped in %...%) — not fine for a tool using ilike to do a
// case-insensitive EXACT match (delete_catalog_product), where an
// unescaped "%" or "_" in a real product name would silently widen the
// match to a *different* row than the one asked for. Escaping the
// backslash first avoids double-escaping the ones just added.
export function escapeIlikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

// The three document/text pipeline stages that get a lead-reviewed
// deliverable (Storyboarding/Scripting/Prompting) — the Editing->Published
// leg uses video_versions instead, not this table (see schema.sql).
// Shared by lead.ts (review_deliverable's stage validation) and read.ts
// (get_deliverable_summary's stage x decision breakdown).
export const DOC_STAGES = ["Storyboarding", "Scripting", "Prompting"] as const;

// Shared by every product-locating tool below (operator's and lead's) —
// mirrors get_product's same-shaped params so the model can reuse whichever
// it already has from a prior read-tool call.
export const PRODUCT_LOCATOR_SHAPE = {
  rank: z.number().int().optional().describe("The product's rank number."),
  id: z.string().uuid().optional().describe("The product's id, if already known."),
};

// Shared by every tool that locates a product by rank or id. Hoisted to
// module scope (rather than a per-builder closure) since both the operator
// and lead action-tool builders need it.
export async function resolveProductId(
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

// Issue tools — shared by operator and lead (RLS allows any authenticated
// role to insert/update issues; the table has no "reported-by" column, so
// no userId is needed here). Neither requires toolApproval — low-risk,
// matches the real UI's own frictionless report/resolve buttons regardless
// of who's clicking them.
export function buildIssueTools(supabase: SupabaseServerClient) {
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
  };
}
