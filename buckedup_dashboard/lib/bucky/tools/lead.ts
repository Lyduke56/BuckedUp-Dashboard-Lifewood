import { tool } from "ai";
import { z } from "zod";
import { STATUS_ORDER } from "@/lib/data";
import type { UserRole } from "@/lib/types";
import {
  safe,
  PRODUCT_LOCATOR_SHAPE,
  buildIssueTools,
  escapeIlikePattern,
  DOC_STAGES,
  UNDO_WINDOW_MS,
  type SupabaseServerClient,
} from "./shared";

// Pipeline-management tools, shared by lead AND admin — the 5-stage
// pipeline refactor expanded admin from governance-only to a full
// super-user (products/catalog RLS now allows lead OR admin, the
// update-permissions trigger passes both through, and the dashboard UI
// shows admin the same review/catalog/edit controls as lead). Most require
// toolApproval (see route.ts) — team-visible workflow changes, not
// self-scoped routine work like the operator tools; report_issue/
// resolve_issue are the exception, shared verbatim with operator via
// buildIssueTools since they're low-risk regardless of who's calling
// them. Every write goes through the caller's own session client
// (RLS-enforced) — the caller's real DB permissions are the actual
// authority here, this just gives chat access to what the UI already
// allows. (update_production_plan is NOT here — plan writes moved to
// admin-only in the same refactor, so it lives in admin.ts now.)
function buildLeadActionTools(supabase: SupabaseServerClient, userId: string) {
  return {
    ...buildIssueTools(supabase),

    move_product_stage: tool({
      description:
        "Directly set a product's pipeline stage to any of the 5 stages, bypassing normal review. Prefer review_deliverable or review_video when actually reviewing a submission — use this for corrections or exceptions. Requires confirmation before it runs.",
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
        "Accept or reject a specific document deliverable (Storyboarding or Scripting) for a product in its Design stage. Once both Storyboarding and Scripting are accepted, the product advances to Production automatically. Rejecting keeps it in Design and records the note as the product's rejection reason. A note is required when rejecting. Requires confirmation before it runs.",
      inputSchema: z.object({
        ...PRODUCT_LOCATOR_SHAPE,
        stage: z.enum(["Storyboarding", "Scripting"]).describe("The deliverable stage to review: 'Storyboarding' or 'Scripting'."),
        decision: z.enum(["accepted", "rejected"]),
        note: z.string().optional(),
      }),
      execute: ({ rank, id, stage, decision, note }) =>
        safe(async () => {
          if (!rank && !id) return { error: "Provide either rank or id." };
          let query = supabase.from("products").select("id, name, status");
          query = id ? query.eq("id", id) : query.eq("rank", rank as number);
          const { data: product, error } = await query.maybeSingle();
          if (error) return { error: error.message };
          if (!product) return { error: "No product found." };
          if (product.status !== "Design") {
            return {
              error: `${product.name} is currently in "${product.status}" — deliverable review only applies during the Design stage.`,
            };
          }
          if (decision === "rejected" && !note) {
            return { error: "A note is required when rejecting a deliverable." };
          }
          const { data: deliverable, error: deliverableError } = await supabase
            .from("stage_deliverables")
            .select("id")
            .eq("product_id", product.id)
            .eq("stage", stage)
            .eq("is_current", true)
            .maybeSingle();
          if (deliverableError) return { error: deliverableError.message };
          if (!deliverable) {
            return { error: `No pending deliverable found for ${product.name} in ${stage}.` };
          }
          const { error: rpcError } = await supabase.rpc("review_stage_deliverable", {
            p_deliverable_id: deliverable.id,
            p_decision: decision,
            p_note: note ?? null,
          });
          if (rpcError) return { error: rpcError.message };
          return { reviewed: true, product: product.name, stage, decision };
        }),
    }),

    review_video: tool({
      description:
        "Accept or reject a product's submitted video. Accepting PUBLISHES it (sets its stage to Published) — this is the single most consequential action available. Rejecting sends it back to Production for rework. Only works for a product currently In Review. A note is required when rejecting. Requires confirmation before it runs.",
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
          // Reject sends the video back to Production for rework — mirrors
          // ProductReviewModal's own "Reject to Production" button exactly.
          // (Pre-refactor this was "Editing", a stage that no longer exists
          // in the 5-stage pipeline.)
          const { error: updateError } = await supabase
            .from("products")
            .update(
              decision === "accepted"
                ? { review_status: "Accepted", rejection_reason: null, status: "Published" }
                : { review_status: "Rejected", rejection_reason: note, status: "Production" },
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
        ownerEmail: z.string().optional().describe("The owner's email address."),
        publishDate: z.string().optional().describe("YYYY-MM-DD"),
        deliveryType: z.enum(["pipeline", "link"]).default("pipeline"),
        videoUrl: z.string().url().optional().describe("Required when deliveryType is 'link'."),
        rank: z.number().int().optional().describe("Defaults to the next available rank if omitted."),
        priority: z.enum(["High", "Medium", "Low"]).optional().describe("Defaults to Low if omitted."),
      }),
      execute: (params) =>
        safe(async () => {
          const { catalogProductId, ownerEmail, deliveryType, videoUrl, rank, publishDate, language, contentType, contentAngle, priority } =
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
              // Omitting the column entirely lets the DB default ('Low')
              // apply — only send it when the caller actually chose one.
              ...(priority ? { priority } : {}),
            })
            .select("id, rank, name")
            .single();
          if (insertError) return { error: insertError.message };
          return { created: true, product: created };
        }),
    }),

    delete_product: tool({
      description:
        "Delete a product. Cascades to its issues, deliverables, video versions, and status history. Recoverable for a short window afterward — if this turns out to be a mistake, call restore_product with the product's name. Requires confirmation before it runs.",
      inputSchema: z.object(PRODUCT_LOCATOR_SHAPE),
      execute: ({ rank, id }) =>
        safe(async () => {
          if (!rank && !id) return { error: "Provide either rank or id." };
          let query = supabase.from("products").select("*");
          query = id ? query.eq("id", id) : query.eq("rank", rank as number);
          const { data: product, error } = await query.maybeSingle();
          if (error) return { error: error.message };
          if (!product) return { error: "No product found." };

          // Snapshot everything that would cascade away before deleting,
          // so restore_product can bring it all back. notifications is
          // deliberately excluded — its RLS is recipient-only for select,
          // so a lead's own session can't even read another user's rows
          // tied to this product, and it's low-value transient state
          // anyway (see plan notes for the full reasoning).
          const [issuesRes, historyRes, versionsRes, deliverablesRes] = await Promise.all([
            supabase.from("issues").select("*").eq("product_id", product.id),
            supabase.from("product_status_history").select("*").eq("product_id", product.id),
            supabase.from("video_versions").select("*").eq("product_id", product.id),
            supabase.from("stage_deliverables").select("*").eq("product_id", product.id),
          ]);
          if (issuesRes.error) return { error: issuesRes.error.message };
          if (historyRes.error) return { error: historyRes.error.message };
          if (versionsRes.error) return { error: versionsRes.error.message };
          if (deliverablesRes.error) return { error: deliverablesRes.error.message };

          const { error: snapshotError } = await supabase.from("bucky_deleted_product_snapshots").insert({
            user_id: userId,
            product_name: product.name,
            product_rank: product.rank,
            snapshot: {
              product,
              issues: issuesRes.data ?? [],
              product_status_history: historyRes.data ?? [],
              video_versions: versionsRes.data ?? [],
              stage_deliverables: deliverablesRes.data ?? [],
            },
            expires_at: new Date(Date.now() + UNDO_WINDOW_MS).toISOString(),
          });
          if (snapshotError) return { error: snapshotError.message };

          const { error: deleteError } = await supabase.from("products").delete().eq("id", product.id);
          if (deleteError) return { error: deleteError.message };
          return { deleted: true, product: product.name, restorableForHours: UNDO_WINDOW_MS / 3_600_000 };
        }),
    }),

    restore_product: tool({
      description:
        "Restore a product that was recently deleted through Bucky, within its undo window. Call list_recent_deletions first if you don't already know its name from this conversation. Runs immediately, no confirmation needed — restoring is safe and additive.",
      inputSchema: z.object({
        productName: z.string().describe("The deleted product's former name — restores the most recent matching deletion."),
      }),
      execute: ({ productName }) =>
        safe(async () => {
          const { data: snapshot, error } = await supabase
            .from("bucky_deleted_product_snapshots")
            .select("id")
            .ilike("product_name", escapeIlikePattern(productName))
            .is("restored_at", null)
            .gt("expires_at", new Date().toISOString())
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (error) return { error: error.message };
          if (!snapshot) {
            return {
              error: `No restorable deletion found for "${productName}" — it may already be restored, or its undo window may have closed. Call list_recent_deletions to see what's still restorable.`,
            };
          }
          const { data: restoredId, error: rpcError } = await supabase.rpc("restore_deleted_product", {
            p_snapshot_id: snapshot.id,
          });
          if (rpcError) return { error: rpcError.message };
          return { restored: true, product: productName, id: restoredId };
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
        "Delete a BuckedUp catalog product. Hides the listing rather than destroying it — it's recoverable any time afterward with restore_catalog_product, and any product still linked to it keeps that link. Requires confirmation before it runs.",
      inputSchema: z.object({
        id: z.string().uuid().optional(),
        name: z.string().optional().describe("Exact name match — used only if id isn't given."),
      }),
      execute: ({ id, name }) =>
        safe(async () => {
          if (!id && !name) return { error: "Provide either id or name." };
          let query = supabase.from("catalog_products").select("id, name").eq("is_active", true);
          // escapeIlikePattern makes this a real case-insensitive EXACT
          // match, not a wildcard pattern — a name containing a literal
          // "%" or "_" must match only that literal name, never silently
          // match a different row (see the comment on escapeIlikePattern).
          query = id ? query.eq("id", id) : query.ilike("name", escapeIlikePattern(name as string));
          const { data: matches, error } = await query;
          if (error) return { error: error.message };
          if (!matches || matches.length === 0) return { error: "No active catalog product found." };
          if (matches.length > 1) {
            return {
              error: `Multiple catalog products match "${name}" — be more specific or provide the exact id. Matches: ${matches.map((m) => m.name).join(", ")}`,
            };
          }
          const { error: updateError } = await supabase
            .from("catalog_products")
            .update({ is_active: false })
            .eq("id", matches[0].id);
          if (updateError) return { error: updateError.message };
          return { deleted: true, product: matches[0].name };
        }),
    }),

    restore_catalog_product: tool({
      description:
        "Restore a catalog product that was deleted through Bucky. Runs immediately, no confirmation needed — restoring is safe and additive.",
      inputSchema: z.object({
        id: z.string().uuid().optional(),
        name: z.string().optional().describe("Exact name match — used only if id isn't given."),
      }),
      execute: ({ id, name }) =>
        safe(async () => {
          if (!id && !name) return { error: "Provide either id or name." };
          let query = supabase.from("catalog_products").select("id, name").eq("is_active", false);
          query = id ? query.eq("id", id) : query.ilike("name", escapeIlikePattern(name as string));
          const { data: matches, error } = await query;
          if (error) return { error: error.message };
          if (!matches || matches.length === 0) return { error: "No deleted catalog product found matching that." };
          if (matches.length > 1) {
            return {
              error: `Multiple deleted catalog products match "${name}" — be more specific or provide the exact id. Matches: ${matches.map((m) => m.name).join(", ")}`,
            };
          }
          const { error: updateError } = await supabase
            .from("catalog_products")
            .update({ is_active: true })
            .eq("id", matches[0].id);
          if (updateError) return { error: updateError.message };
          return { restored: true, product: matches[0].name };
        }),
    }),
  };
}

// Same role-gate-returns-{} pattern as the operator/admin builders. Admin
// is included since the pipeline refactor made admin a full super-user
// (products/catalog RLS, the update-permissions trigger, and the dashboard
// UI's review/catalog/edit controls all treat lead and admin identically
// now) — the DB would allow it anyway; this just stops Bucky from
// artificially refusing what the UI already offers.
export function createBuckyLeadActionTools(
  supabase: SupabaseServerClient,
  role: UserRole,
  userId: string,
): ReturnType<typeof buildLeadActionTools> {
  if (role !== "lead" && role !== "admin") return {} as ReturnType<typeof buildLeadActionTools>;
  return buildLeadActionTools(supabase, userId);
}
