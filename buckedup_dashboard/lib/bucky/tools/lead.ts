import { tool } from "ai";
import { z } from "zod";
import { STATUS_ORDER } from "@/lib/data";
import type { UserRole } from "@/lib/types";
import { safe, PRODUCT_LOCATOR_SHAPE, buildIssueTools, escapeIlikePattern, type SupabaseServerClient } from "./shared";

const DOC_STAGES = ["Storyboarding", "Scripting", "Prompting"] as const;

// Lead's pipeline-management tools. Most require toolApproval (see
// route.ts) — team-visible workflow changes, not self-scoped routine work
// like the operator tools above; report_issue/resolve_issue are the
// exception, shared verbatim with operator via buildIssueTools since
// they're low-risk regardless of who's calling them. Every write goes
// through the caller's own session client (RLS-enforced) — lead's real DB
// permissions are the actual authority here, this just gives chat access
// to what the UI already allows.
function buildLeadActionTools(supabase: SupabaseServerClient) {
  return {
    ...buildIssueTools(supabase),

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

    update_production_plan: tool({
      description:
        "Update the active production plan's targets, dates, or notes. Only changes the fields you provide — everything else (including any Excel-imported daily pacing schedule) stays untouched. If no plan is active yet, creates one (name, startDate, and deadline are then required). Requires confirmation before it runs.",
      inputSchema: z.object({
        name: z.string().optional(),
        totalVideoTarget: z.number().int().optional(),
        startDate: z.string().optional().describe("YYYY-MM-DD"),
        deadline: z.string().optional().describe("YYYY-MM-DD"),
        notes: z.string().optional(),
        categoryTargets: z.record(z.string(), z.number()).optional(),
        languageTargets: z.record(z.string(), z.number()).optional(),
      }),
      execute: (params) =>
        safe(async () => {
          const { data: current, error: fetchError } = await supabase
            .from("production_plans")
            .select("*")
            .eq("is_active", true)
            .maybeSingle();
          if (fetchError) return { error: fetchError.message };

          if (current) {
            const updatePayload: Record<string, unknown> = {};
            if (params.name !== undefined) updatePayload.name = params.name;
            if (params.totalVideoTarget !== undefined) updatePayload.total_video_target = params.totalVideoTarget;
            if (params.startDate !== undefined) updatePayload.start_date = params.startDate;
            if (params.deadline !== undefined) updatePayload.deadline = params.deadline;
            if (params.notes !== undefined) updatePayload.notes = params.notes;
            if (params.categoryTargets !== undefined) updatePayload.category_targets = params.categoryTargets;
            if (params.languageTargets !== undefined) updatePayload.language_targets = params.languageTargets;
            if (Object.keys(updatePayload).length === 0) {
              return { error: "Provide at least one field to update." };
            }
            const { error: updateError } = await supabase
              .from("production_plans")
              .update(updatePayload)
              .eq("id", current.id);
            if (updateError) return { error: updateError.message };
            return { updated: true, plan: params.name ?? current.name };
          }

          if (!params.name || !params.startDate || !params.deadline) {
            return { error: "No active plan exists yet — name, startDate, and deadline are required to create one." };
          }
          const { error: insertError } = await supabase.from("production_plans").insert({
            name: params.name,
            total_video_target: params.totalVideoTarget ?? 0,
            start_date: params.startDate,
            deadline: params.deadline,
            notes: params.notes ?? null,
            category_targets: params.categoryTargets ?? {},
            language_targets: params.languageTargets ?? {},
            is_active: true,
          });
          if (insertError) return { error: insertError.message };
          return { created: true, plan: params.name };
        }),
    }),

    create_or_update_catalog_product: tool({
      description:
        "Create a new BuckedUp catalog product, or update an existing one by id — updating only changes the fields you provide, everything else stays as-is. Thumbnails aren't supported through chat — use the dashboard UI for those. Requires confirmation before it runs.",
      inputSchema: z.object({
        id: z
          .string()
          .uuid()
          .optional()
          .describe("Provide to update an existing catalog product; omit to create a new one."),
        name: z.string().optional().describe("Required when creating."),
        category: z.string().optional().describe("Required when creating."),
        subcategory: z.string().optional().describe("Required when creating."),
        variants: z.array(z.string()).optional(),
        price: z.string().optional(),
        flagStatus: z.string().optional(),
        productUrl: z.string().optional(),
        isActive: z.boolean().optional(),
      }),
      execute: (params) =>
        safe(async () => {
          if (params.id) {
            const updatePayload: Record<string, unknown> = {};
            if (params.name !== undefined) updatePayload.name = params.name;
            if (params.category !== undefined) updatePayload.category = params.category;
            if (params.subcategory !== undefined) updatePayload.subcategory = params.subcategory;
            if (params.variants !== undefined) updatePayload.variants = params.variants;
            if (params.price !== undefined) updatePayload.price = params.price;
            if (params.flagStatus !== undefined) updatePayload.flag_status = params.flagStatus;
            if (params.productUrl !== undefined) updatePayload.product_url = params.productUrl;
            if (params.isActive !== undefined) updatePayload.is_active = params.isActive;
            if (Object.keys(updatePayload).length === 0) {
              return { error: "Provide at least one field to update." };
            }
            const { data: updated, error: updateError } = await supabase
              .from("catalog_products")
              .update(updatePayload)
              .eq("id", params.id)
              .select("id, name")
              .maybeSingle();
            if (updateError) return { error: updateError.message };
            if (!updated) return { error: "No catalog product found with that id." };
            return { updated: true, product: updated.name };
          }

          if (!params.name || !params.category || !params.subcategory) {
            return {
              error: "Provide id to update an existing item, or name, category, and subcategory to create a new one.",
            };
          }
          const { data: created, error: insertError } = await supabase
            .from("catalog_products")
            .insert({
              name: params.name,
              category: params.category,
              subcategory: params.subcategory,
              variants: params.variants ?? [],
              price: params.price ?? null,
              flag_status: params.flagStatus ?? null,
              product_url: params.productUrl ?? null,
              is_active: params.isActive ?? true,
            })
            .select("id, name")
            .single();
          if (insertError) return { error: insertError.message };
          return { created: true, product: created.name };
        }),
    }),

    delete_catalog_product: tool({
      description:
        "Delete a BuckedUp catalog product. This is irreversible. Only removes the catalog listing — if a video is linked to it, the video itself isn't deleted, only unlinked. Requires confirmation before it runs.",
      inputSchema: z.object({
        id: z.string().uuid().optional(),
        name: z.string().optional().describe("Exact name match — used only if id isn't given."),
      }),
      execute: ({ id, name }) =>
        safe(async () => {
          if (!id && !name) return { error: "Provide either id or name." };
          let query = supabase.from("catalog_products").select("id, name");
          // escapeIlikePattern makes this a real case-insensitive EXACT
          // match, not a wildcard pattern — a name containing a literal
          // "%" or "_" must match only that literal name, never silently
          // match a different row (see the comment on escapeIlikePattern).
          query = id ? query.eq("id", id) : query.ilike("name", escapeIlikePattern(name as string));
          const { data: matches, error } = await query;
          if (error) return { error: error.message };
          if (!matches || matches.length === 0) return { error: "No catalog product found." };
          if (matches.length > 1) {
            return {
              error: `Multiple catalog products match "${name}" — be more specific or provide the exact id. Matches: ${matches.map((m) => m.name).join(", ")}`,
            };
          }
          const { error: deleteError } = await supabase.from("catalog_products").delete().eq("id", matches[0].id);
          if (deleteError) return { error: deleteError.message };
          return { deleted: true, product: matches[0].name };
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
