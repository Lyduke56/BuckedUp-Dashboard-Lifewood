import { tool } from "ai";
import { z } from "zod";
import type { UserRole } from "@/lib/types";
import { safe, PRODUCT_LOCATOR_SHAPE, resolveProductId, buildIssueTools, type SupabaseServerClient } from "./shared";

// Operator's own work-execution tools. None of these require toolApproval
// (see route.ts) — they're the operator doing their own routine, self-scoped
// job, exactly as frictionless as the equivalent buttons in
// VideoLibraryView/ProductFormModal/VideoVersionsPanel today. Every write
// goes through the caller's own session client (RLS-enforced), same as the
// read tools — no service-role client here either.
function buildOperatorActionTools(supabase: SupabaseServerClient, userId: string) {
  return {
    ...buildIssueTools(supabase),

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
            .update({ owner_id: userId, status: "Design" })
            .eq("id", product.id);
          if (updateError) return { error: updateError.message };
          return { claimed: product.name };
        }),
    }),

    submit_deliverable: tool({
      description:
        "Submit a text deliverable (Storyboarding or Scripting) for a product you own during its Design stage. File attachments aren't supported through chat — use the dashboard UI for those. Runs immediately, no confirmation needed.",
      inputSchema: z.object({
        ...PRODUCT_LOCATOR_SHAPE,
        stage: z.enum(["Storyboarding", "Scripting"]).describe("The deliverable stage to submit: 'Storyboarding' or 'Scripting'."),
        textContent: z.string().min(1),
      }),
      execute: ({ rank, id, stage, textContent }) =>
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
          if (product.status !== "Design") {
            return {
              error: `${product.name} is currently in "${product.status}" — deliverables can only be submitted during the Design stage.`,
            };
          }
          const { error: insertError } = await supabase.from("stage_deliverables").insert({
            product_id: product.id,
            stage,
            kind: "text",
            text_content: textContent.trim(),
            submitted_by: userId,
          });
          if (insertError) return { error: insertError.message };
          return { submitted: true, product: product.name, stage };
        }),
    }),

    submit_video_for_review: tool({
      description:
        "Submit a product's video for review, moving it from Production to In Review. The server checks ownership and stage automatically and returns a clear error if either doesn't hold — don't try to pre-verify ownership yourself from a product's owner_id (you can't reliably tell if a raw id is 'you'), just call this directly when asked. Runs immediately, no confirmation needed.",
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
