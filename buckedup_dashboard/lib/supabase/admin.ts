import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Privileged Supabase client using the service_role key — bypasses RLS
 * entirely. Server-only (SUPABASE_SERVICE_ROLE_KEY is never prefixed
 * NEXT_PUBLIC_, so it's never bundled to the browser). For one-off
 * server-side operations like the migration script, not for anything a
 * request handler exposes to end users.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
