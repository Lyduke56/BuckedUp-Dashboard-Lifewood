import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Landing point for Supabase invite/recovery email links. Exchanges the
// token_hash for a session (setting cookies) and hands off to "/", where
// Dashboard's mustChangePassword gate takes over for a freshly-invited user.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(`${origin}/`);
    }
  }

  // A failed verify leaves whatever session was already in this browser
  // untouched. If that happened to be a different, already-authenticated
  // account, proxy.ts's "authenticated user hitting /login -> bounce to /"
  // rule fires before the error banner ever renders — silently dropping
  // the user into that unrelated account's dashboard with no indication
  // the invite link failed. Sign out first so /login actually loads.
  await supabase.auth.signOut();
  return NextResponse.redirect(`${origin}/login?error=invite-link-invalid`);
}
