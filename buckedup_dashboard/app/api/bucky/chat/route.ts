import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";
import { createOpenRouter, type OpenRouterUsageAccounting } from "@openrouter/ai-sdk-provider";
import { createClient } from "@/lib/supabase/server";
import {
  createBuckyReadTools,
  createBuckyPlanReadTools,
  createBuckySuperAdminActionTools,
  createBuckyOperatorActionTools,
  createBuckyAdminActionTools,
  BUCKY_TOOL_APPROVAL,
  BUCKY_TOOL_METADATA,
  type AnyBuckyToolName,
} from "@/lib/bucky/tools";
import { buildSystemPrompt, type BuckyCatalogContext, type BuckyProductContext } from "@/lib/bucky/systemPrompt";
import { checkAndRecordRateLimit } from "@/lib/bucky/rateLimit";
import type { UserRole, ViewId } from "@/lib/types";

const VALID_ROLES: UserRole[] = ["super-admin", "admin", "operator"];

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

// Free-tier models per the PM's budget constraint. OpenRouter's free-tier
// rate limits are governed per-model, not per-account (confirmed via their
// own docs), so a fallback chain across distinct models is a real quota
// multiplier, not just a reliability patch — if the primary model 429s or
// errors before it starts responding, OpenRouter automatically retries the
// next one in this list with zero extra code here. All three are confirmed
// (as of this writing) to support tool-calling, which Bucky needs.
// openrouter/free is a meta-model that randomly load-balances across
// OpenRouter's whole free-model pool — kept last since you lose control
// over which model answers (tone/quality varies turn to turn).
const MODEL = "openai/gpt-oss-20b:free";
const FALLBACK_MODELS = [MODEL, "meta-llama/llama-3.3-70b-instruct:free", "openrouter/free"];

export async function POST(request: Request) {
  // Same auth pattern as app/api/super-admin/create-user/route.ts: session check,
  // then re-check the caller's own role under their own session, before
  // doing anything privileged. Every tool below queries through this same
  // session client, so it inherits this authorization automatically.
  //
  // Bucky is reachable by any authenticated role now (super-admin/admin/operator)
  // — the read tools already query through RLS, which is public-read on
  // every table they touch, so widening access exposes nothing new. What
  // stays role-gated is the *action* tool sets: account-management and
  // production-plan tools (createBuckySuperAdminActionTools) are super-admin-only,
  // work-execution tools (createBuckyOperatorActionTools) are
  // operator-only, pipeline/catalog-management tools
  // (createBuckyAdminActionTools) go to admin AND super-admin — super-admin became a
  // full super-user in the 5-stage pipeline refactor.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = profile?.role as UserRole | undefined;
  if (!role || !VALID_ROLES.includes(role)) {
    return new Response(JSON.stringify({ error: "No valid role for this account" }), { status: 403 });
  }

  // Rejected as cheaply as possible — before the request body is even
  // parsed. See lib/bucky/rateLimit.ts for why this is DB-backed rather
  // than an in-memory counter.
  const rateLimitOk = await checkAndRecordRateLimit(supabase, user.id);
  if (!rateLimitOk) {
    return new Response(
      JSON.stringify({ error: "You're sending messages too quickly — wait a moment and try again." }),
      { status: 429 },
    );
  }

  const {
    messages,
    activeView,
    currentProduct,
    currentCatalogProduct,
  }: {
    messages: UIMessage[];
    activeView?: ViewId;
    currentProduct?: BuckyProductContext | null;
    currentCatalogProduct?: BuckyCatalogContext | null;
  } = await request.json();

  const result = streamText({
    model: openrouter.chat(MODEL, {
      models: FALLBACK_MODELS,
      // Strips the hidden chain-of-thought/"analysis" channel server-side —
      // a real API-level fix for the reasoning-leak issue this app was
      // previously only papering over with a client-side regex filter
      // (isLeakedReasoning in BuckyWidget.tsx, kept as a backstop since
      // this isn't guaranteed to work on every backend serving these
      // models).
      reasoning: { exclude: true, effort: "low" },
      // Asks OpenRouter to include real token/cost accounting on the
      // response so onFinish below can log it — see the comment there.
      usage: { include: true },
    }),
    system: buildSystemPrompt(role, activeView, currentProduct, currentCatalogProduct),
    messages: await convertToModelMessages(messages),
    tools: {
      ...createBuckyReadTools(supabase),
      ...createBuckyPlanReadTools(supabase, role),
      ...createBuckySuperAdminActionTools(supabase, request, role),
      ...createBuckyOperatorActionTools(supabase, role, user.id),
      ...createBuckyAdminActionTools(supabase, role, user.id),
    },
    // Mutating actions never run on the model's say-so alone — the tool
    // call only proposes the action; execute() only actually runs once the
    // caller confirms in the chat UI (BuckyWidget renders the
    // approval-requested state as a confirm/cancel card). Read tools and
    // the operator's own work-execution tools are absent from this map,
    // which defaults them to no approval needed. Derived from
    // BUCKY_TOOL_METADATA (lib/bucky/tools/metadata.ts) rather than
    // hand-written — that file is the single source of truth for which
    // tools need approval, and TypeScript refuses to compile it if a new
    // tool is ever added to any builder without a matching entry there.
    toolApproval: BUCKY_TOOL_APPROVAL,
    // Default stopWhen is isStepCount(1) — the model would call a tool and
    // the stream would end right there, with no natural-language answer
    // using the result. Allow a few steps so it can call a tool then
    // actually respond.
    stopWhen: stepCountIs(5),
    // The manager's OpenRouter key has a hard $5 cap and an explicit ask to
    // avoid unnecessary/expensive model use — every configured fallback
    // model is :free-suffixed, so cost should always read 0 here. Logging
    // it (and which model actually answered, since the fallback chain can
    // pick something other than MODEL) is a cheap audit trail proving
    // that, and a tripwire if a fallback ever silently lands on something
    // billable. console.warn (not .log) when cost is nonzero so that
    // stands out from routine free-tier noise.
    onFinish: ({ usage, providerMetadata, response }) => {
      const openrouterUsage = providerMetadata?.openrouter?.usage as OpenRouterUsageAccounting | undefined;
      const cost = openrouterUsage?.cost;
      const log = cost ? console.warn : console.log;
      log("[bucky-usage]", {
        userId: user.id,
        role,
        model: response.modelId,
        promptTokens: usage.inputTokens,
        completionTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
        cost: cost ?? 0,
      });
    },
    // Durable audit trail for mutating tools — who, what, with what
    // arguments, and what happened. Only fires for tool calls that
    // actually executed, which by construction means it never sees a
    // *denied* approval-gated call (a denial blocks execution entirely —
    // see the client-side insert in BuckyWidget.tsx's Cancel handler for
    // that half of the picture). Read tools are skipped entirely: most
    // audit value is in mutations, and logging full row-dump outputs
    // (e.g. list_products) wouldn't be useful or safe by default.
    onToolExecutionEnd: async (event) => {
      const toolName = event.toolCall.toolName as AnyBuckyToolName;
      const meta = BUCKY_TOOL_METADATA[toolName];
      if (!meta?.mutating) return;

      const isSdkError = event.toolOutput.type === "tool-error";
      // tools.ts's safe() wrapper never throws for expected/business-logic
      // failures (e.g. "No product found.") — it resolves normally with a
      // { error: "..." } object, so a real failure has to be detected two
      // ways, not just via the SDK's own tool-error discriminant.
      const output = !isSdkError ? event.toolOutput.output : undefined;
      const businessError =
        !isSdkError && output && typeof output === "object" && "error" in output
          ? String((output as { error: unknown }).error)
          : null;

      try {
        await supabase.from("bucky_audit_log").insert({
          user_id: user.id,
          role,
          tool_name: toolName,
          status: isSdkError || businessError ? "error" : "success",
          input: event.toolCall.input ?? {},
          result_summary: isSdkError ? null : output,
          error_message: isSdkError ? String(event.toolOutput.error) : businessError,
          call_id: event.callId,
        });
      } catch (err) {
        // Never let an audit-write failure break the user's actual result.
        console.error("bucky-audit-log insert failed:", err);
      }
    },
  });

  return result.toUIMessageStreamResponse({
    onError: (error) => {
      // Surfaces as an error part in the client stream rather than a raw
      // aborted connection — e.g. OpenRouter's free-tier upstream rate
      // limits ("temporarily rate-limited upstream, retry shortly").
      console.error("bucky chat stream error:", error);
      return error instanceof Error ? error.message : "Unknown error";
    },
  });
}
