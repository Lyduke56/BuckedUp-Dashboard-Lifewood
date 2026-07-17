import type { SupabaseServerClient } from "./tools/shared";

// Comfortably under OpenRouter's own 20/min-per-model free-tier ceiling —
// this is meant to be a real backstop against a buggy client or repeated
// back-to-back sending, not a duplicate of what OpenRouter already
// enforces upstream. Generous enough that a normal, human-paced
// back-and-forth conversation never comes close to tripping it.
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 10;

// Every chat request costs real usage against the manager's $5-capped
// OpenRouter key — even a read-only question, not just mutating tool
// calls (those already get their own separate audit trail, see
// lib/bucky/tools/metadata.ts + route.ts's onToolExecutionEnd). This is a
// database-backed limiter, not an in-memory one, since this app's
// deployment topology (single persistent server vs. serverless/
// multi-instance) isn't knowable from the codebase alone — a plain
// in-memory Map would silently under-enforce across multiple instances.
//
// Self-cleaning by construction: expired rows for this user are deleted
// before ever being counted, so the table never holds more than
// MAX_REQUESTS_PER_WINDOW rows per currently-active user — no separate
// cleanup job needed.
//
// Fails open on any DB error (returns true, logs it) — matches this
// codebase's safe() philosophy elsewhere in lib/bucky/: a transient infra
// hiccup should never block a real request.
export async function checkAndRecordRateLimit(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<boolean> {
  const windowStartIso = new Date(Date.now() - WINDOW_MS).toISOString();

  const { error: deleteError } = await supabase
    .from("bucky_rate_limit_log")
    .delete()
    .eq("user_id", userId)
    .lt("created_at", windowStartIso);
  if (deleteError) console.error("bucky-rate-limit cleanup failed:", deleteError);

  const { count, error: countError } = await supabase
    .from("bucky_rate_limit_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (countError) {
    console.error("bucky-rate-limit check failed:", countError);
    return true;
  }
  if ((count ?? 0) >= MAX_REQUESTS_PER_WINDOW) return false;

  const { error: insertError } = await supabase.from("bucky_rate_limit_log").insert({ user_id: userId });
  if (insertError) console.error("bucky-rate-limit insert failed:", insertError);

  return true;
}
