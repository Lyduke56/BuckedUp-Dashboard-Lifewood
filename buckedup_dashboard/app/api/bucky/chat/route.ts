import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createClient } from "@/lib/supabase/server";
import { createBuckyReadTools, createBuckyActionTools } from "@/lib/bucky/tools";
import { BUCKY_SYSTEM_PROMPT } from "@/lib/bucky/systemPrompt";

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

// Free-tier model per the PM's budget constraint. Verified end-to-end
// (auth guards, tool execution, and the tool-call-then-answer loop all
// work) — the one open item is answer *quality* on this specific free
// model, which can be terse (tightened the system prompt below to push
// back on that). meta-llama/llama-3.3-70b-instruct:free is a documented,
// untested-so-far alternative (its first live attempt hit a transient
// upstream 429 from OpenRouter's free-tier routing, not a code issue) —
// worth trying if this one's answers stay weak in real use.
// OpenRouter's free daily quota is low until the account has $10+ in
// lifetime purchases — if either model starts erroring/rate-limiting,
// that's likely why.
const MODEL = "openai/gpt-oss-20b:free";

export async function POST(request: Request) {
  // Same auth pattern as app/api/admin/create-user/route.ts: session check,
  // then re-check the caller's own role under their own session, before
  // doing anything privileged. Every tool below queries through this same
  // session client, so it inherits this authorization automatically.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403 });
  }

  const { messages }: { messages: UIMessage[] } = await request.json();

  const result = streamText({
    model: openrouter.chat(MODEL),
    system: BUCKY_SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools: {
      ...createBuckyReadTools(supabase),
      ...createBuckyActionTools(supabase, request),
    },
    // Account-management actions never run on the model's say-so alone —
    // the tool call only proposes the action; execute() only actually
    // runs once the admin confirms in the chat UI (BuckyWidget renders
    // the approval-requested state as a confirm/cancel card). Read tools
    // are absent from this map, which defaults them to no approval
    // needed.
    toolApproval: {
      create_user: "user-approval",
      delete_user: "user-approval",
      change_role: "user-approval",
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
