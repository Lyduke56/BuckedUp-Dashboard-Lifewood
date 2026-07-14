import { randomInt } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/lib/types";

const ROLE_VALUES: UserRole[] = ["operator", "lead", "admin"];
const MIN_PASSWORD_LENGTH = 8;
// Excludes visually-ambiguous characters (0/O, 1/l/I) since this is meant
// to be read off a screen and typed/copy-pasted by a human once.
const PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

function generateTempPassword(length = 12): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)];
  }
  return out;
}

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

  // 2. Caller must be admin — read under the caller's own session (the
  // existing "Authenticated read" policy on profiles already allows this,
  // no service-role client needed for the check itself).
  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (callerProfile?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  // 3. Validate the request body.
  let body: { email?: unknown; role?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const role = typeof body.role === "string" ? body.role : "";
  const password = typeof body.password === "string" ? body.password.trim() : "";

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }
  if (!ROLE_VALUES.includes(role as UserRole)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  if (password && password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
      { status: 400 },
    );
  }

  // 4. Only now touch the service-role client — everything above this
  // line is a plain, RLS-respecting check under the caller's own session.
  const adminClient = createAdminClient();
  const tempPassword = password || generateTempPassword();

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  });

  if (createError || !created.user) {
    const alreadyExists =
      createError?.status === 422 ||
      /already.*registered|already.*exists/i.test(createError?.message ?? "");
    return NextResponse.json(
      {
        error: alreadyExists
          ? "An account with this email already exists"
          : createError?.message ?? "Failed to create account",
      },
      { status: alreadyExists ? 409 : 500 },
    );
  }

  // 5. handle_new_user() has now inserted a profiles row defaulting to
  // role='operator'/must_change_password=false — set the requested role
  // and flip the flag in one follow-up write.
  const { error: profileError } = await adminClient
    .from("profiles")
    .update({ role, must_change_password: true })
    .eq("id", created.user.id);

  if (profileError) {
    // Best-effort rollback so a retry with the same email doesn't hit a
    // false "already exists" against an orphaned, half-configured account.
    await adminClient.auth.admin.deleteUser(created.user.id).catch(() => {});
    console.error("create-user: failed to set role/flag after account creation", profileError);
    return NextResponse.json(
      { error: "Account creation failed while finishing setup — please retry" },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { email, role, temporaryPassword: tempPassword },
    { status: 201 },
  );
}
