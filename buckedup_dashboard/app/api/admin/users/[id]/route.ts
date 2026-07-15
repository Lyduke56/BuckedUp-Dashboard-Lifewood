import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // 1. Session presence.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // 2. Caller must be admin.
  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (callerProfile?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  // 3. Can't delete your own account from this UI.
  if (id === user.id) {
    return NextResponse.json(
      { error: "You can't delete your own account" },
      { status: 400 },
    );
  }

  // 4. Can't delete the last remaining admin — would lock everyone out of
  // account management. Read under the caller's own session (admin can
  // already read any profile via the existing "Authenticated read" policy).
  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", id)
    .single();

  if (targetProfile?.role === "admin") {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: "Can't delete the last admin account" },
        { status: 400 },
      );
    }
  }

  // 5. Only now touch the service-role client. auth.users deletion cascades
  // to the profiles row via its FK.
  const adminClient = createAdminClient();
  try {
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    // Same transient-network-blip concern as create-user/route.ts — an
    // unhandled exception here would return a non-JSON 500.
    console.error("delete-user: unexpected error", err);
    return NextResponse.json(
      { error: "Something went wrong deleting that account — please try again" },
      { status: 500 },
    );
  }
}
