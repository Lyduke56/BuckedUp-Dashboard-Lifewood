import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client. Reads use the public anon key, so access
 * is governed entirely by the RLS policies in supabase/schema.sql (public
 * read, authenticated write) — never trust this client for anything the
 * database itself doesn't also enforce.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
