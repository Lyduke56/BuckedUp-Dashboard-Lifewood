import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/super-admin";
import { sendInviteEmail } from "@/lib/sendInviteEmail";
import type { UserRole } from "@/lib/types";
import type { User } from "@supabase/supabase-js";

const ROLE_VALUES: UserRole[] = ["operator", "admin", "client"];

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  // 1. Session presence.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // 2. Caller must be super-admin — read under the caller's own session (the
  // existing "Authenticated read" policy on profiles already allows this,
  // no service-role client needed for the check itself).
  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (callerProfile?.role !== "super-admin") {
    return NextResponse.json({ error: "Super-Admin access required" }, { status: 403 });
  }

  // 3. Validate the request body.
  let body: { email?: unknown; role?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const role = typeof body.role === "string" ? body.role : "";

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }
  if (!ROLE_VALUES.includes(role as UserRole)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // 4. Only now touch the service-role client — everything above this
  // line is a plain, RLS-respecting check under the caller's own session.
  const adminClient = createAdminClient();
  const redirectTo = `${new URL(request.url).origin}/auth/confirm`;

  try {
    let created: User;

    // Gmail relay when configured — bypasses Supabase's built-in mailer
    // (2/hour cap, and its SMTP settings need org-super-admin permissions this
    // project's Supabase role doesn't have) by splitting invite-link
    // creation (generateLink, a service-role call, no email sent) from
    // the actual send (our own Gmail SMTP relay). Falls back to
    // inviteUserByEmail when GMAIL_APP_PASSWORD isn't set, so the feature
    // still works either way.
    if (process.env.GMAIL_APP_PASSWORD) {
      const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
        type: "invite",
        email,
        options: { redirectTo },
      });

      if (linkError || !linkData) {
        const alreadyExists = /already.*registered|already.*exists/i.test(linkError?.message ?? "");
        return NextResponse.json(
          { error: alreadyExists ? "An account with this email already exists" : linkError?.message ?? "Failed to create invite link" },
          { status: alreadyExists ? 409 : 500 },
        );
      }

      // Email our own /auth/confirm URL with the hashed token, NOT
      // linkData.properties.action_link. The action_link points at
      // Supabase's hosted /auth/v1/verify endpoint, which consumes the
      // token server-side and then redirects here with the session in a
      // URL fragment — invisible to /auth/confirm's route handler, which
      // expects a token_hash query param and verifies it itself
      // (verifyOtp). Emailing action_link therefore verified the user on
      // Supabase's side but always dead-ended at "invite link invalid"
      // locally, with the one-time token already burned.
      const inviteUrl = `${redirectTo}?token_hash=${linkData.properties.hashed_token}&type=invite`;

      const { error: sendError } = await sendInviteEmail(email, inviteUrl);
      if (sendError) {
        // The auth user + link already exist at this point — same
        // rollback precedent as the profile-update-failure branch below.
        await adminClient.auth.admin.deleteUser(linkData.user.id).catch(() => {});
        console.error("create-user: Gmail relay send failed", sendError);
        return NextResponse.json(
          { error: "Failed to send the invite email — please retry" },
          { status: 500 },
        );
      }

      created = linkData.user;
    } else {
      const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
        email,
        { redirectTo },
      );

      if (inviteError || !inviteData.user) {
        const alreadyExists =
          inviteError?.status === 422 ||
          /already.*registered|already.*exists/i.test(inviteError?.message ?? "");
        // Supabase's built-in email service caps at 2 sends/hour — surface
        // this distinctly rather than a generic 500, since it's an
        // expected, recoverable condition.
        const rateLimited =
          inviteError?.status === 429 ||
          inviteError?.code === "over_email_send_rate_limit";
        return NextResponse.json(
          {
            error: alreadyExists
              ? "An account with this email already exists"
              : rateLimited
                ? "Too many invites sent recently — please try again in a few minutes"
                : inviteError?.message ?? "Failed to send invite",
          },
          { status: alreadyExists ? 409 : rateLimited ? 429 : 500 },
        );
      }

      created = inviteData.user;
    }

    // 5. handle_new_user() has now inserted a profiles row defaulting to
    // role='operator'/must_change_password=false — set the requested role
    // and flip the flag so the invited user is forced to set a password
    // (they have none yet) before seeing the dashboard.
    const { error: profileError } = await adminClient
      .from("profiles")
      .update({ role, must_change_password: true })
      .eq("id", created.id);

    if (profileError) {
      // Best-effort rollback so a retry with the same email doesn't hit a
      // false "already exists" against an orphaned, half-configured account.
      await adminClient.auth.admin.deleteUser(created.id).catch(() => {});
      console.error("create-user: failed to set role/flag after invite", profileError);
      return NextResponse.json(
        { error: "Account creation failed while finishing setup — please retry" },
        { status: 500 },
      );
    }

    return NextResponse.json({ email, role }, { status: 201 });
  } catch (err) {
    // Occasional transient network blips talking to Supabase (seen
    // repeatedly in this environment) throw rather than resolving to the
    // normal { data, error } shape — without this, that's an unhandled
    // exception returning a non-JSON 500, which breaks any caller (this
    // form, or Bucky's create_user tool) trying to parse a JSON error.
    console.error("create-user: unexpected error", err);
    return NextResponse.json(
      { error: "Something went wrong creating that account — please try again" },
      { status: 500 },
    );
  }
}
