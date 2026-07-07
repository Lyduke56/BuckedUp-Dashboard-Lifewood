import { NextRequest, NextResponse } from "next/server";

/**
 * Route-guard stub for the upcoming authorization page.
 *
 * Today this only checks for a mock "buckedup_session" cookie so the
 * folder/route structure is ready. When real auth lands (e.g. Supabase
 * or NextAuth), swap the cookie check below for a verified session/JWT
 * check and keep the same redirect behavior.
 */
export function middleware(request: NextRequest) {
  const isAuthed = request.cookies.get("buckedup_session")?.value === "mock";
  const isLoginPage = request.nextUrl.pathname.startsWith("/login");

  if (!isAuthed && !isLoginPage) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthed && isLoginPage) {
    return NextResponse.redirect(new URL("/overview", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
