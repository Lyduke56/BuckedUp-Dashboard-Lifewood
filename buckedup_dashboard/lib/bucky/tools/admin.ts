import { tool } from "ai";
import { z } from "zod";
import type { UserRole } from "@/lib/types";
import { safe, type SupabaseServerClient } from "./shared";

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
        email: z.string().describe("The new account's email address."),
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
      inputSchema: z.object({ email: z.string().describe("The account's email address.") }),
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
        email: z.string().describe("The account's email address."),
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
