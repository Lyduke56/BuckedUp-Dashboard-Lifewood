import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Privileged Supabase client using the service_role key — bypasses RLS
 * entirely. Server-only (SUPABASE_SERVICE_ROLE_KEY is never prefixed
 * NEXT_PUBLIC_, so it's never bundled to the browser). Only instantiate
 * this AFTER a route handler has independently verified the caller is
 * authenticated and authorized (see app/api/admin/create-user/route.ts) —
 * this client itself performs no authorization checks of its own.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
