import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createClient } from "@/lib/supabase/server";
import {
  createBuckyReadTools,
  createBuckyActionTools,
  createBuckyOperatorActionTools,
  createBuckyLeadActionTools,
} from "@/lib/bucky/tools";
import { buildSystemPrompt } from "@/lib/bucky/systemPrompt";
import type { UserRole } from "@/lib/types";

const VALID_ROLES: UserRole[] = ["admin", "lead", "operator"];

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
  // Same auth pattern as app/api/admin/create-user/route.ts: session check,
  // then re-check the caller's own role under their own session, before
  // doing anything privileged. Every tool below queries through this same
  // session client, so it inherits this authorization automatically.
  //
  // Bucky is reachable by any authenticated role now (admin/lead/operator)
  // — the 8 read tools already query through RLS, which is public-read on
  // every table they touch, so widening access exposes nothing new. What
  // stays role-gated is the *action* tool sets: account-management tools
  // (createBuckyActionTools) are admin-only, work-execution tools
  // (createBuckyOperatorActionTools) are operator-only, pipeline-management
  // tools (createBuckyLeadActionTools) are lead-only.
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

  const { messages }: { messages: UIMessage[] } = await request.json();

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
    }),
    system: buildSystemPrompt(role),
    messages: await convertToModelMessages(messages),
    tools: {
      ...createBuckyReadTools(supabase),
      ...createBuckyActionTools(supabase, request, role),
      ...createBuckyOperatorActionTools(supabase, role, user.id),
      ...createBuckyLeadActionTools(supabase, role),
    },
    // Mutating actions never run on the model's say-so alone — the tool
    // call only proposes the action; execute() only actually runs once the
    // caller confirms in the chat UI (BuckyWidget renders the
    // approval-requested state as a confirm/cancel card). Read tools and
    // the operator's own work-execution tools are absent from this map,
    // which defaults them to no approval needed. Harmless to list entries
    // here even for roles without a given tool — those tools simply won't
    // exist in the map for them (see the corresponding createBucky*Tools).
    toolApproval: {
      create_user: "user-approval",
      delete_user: "user-approval",
      change_role: "user-approval",
      move_product_stage: "user-approval",
      review_deliverable: "user-approval",
      review_video: "user-approval",
      create_product: "user-approval",
      delete_product: "user-approval",
    },
    // Default stopWhen is isStepCount(1) — the model would call a tool and
    // the stream would end right there, with no natural-language answer
    // using the result. Allow a few steps so it can call a tool then
    // actually respond.
    stopWhen: stepCountIs(5),
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
