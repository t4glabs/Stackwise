import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Next.js 16 renamed `middleware.ts` to `proxy.ts` (same behavior, runs on the
// nodejs runtime only — no edge split needed for the Prisma-backed auth() call here).
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const role = req.auth?.user?.role;

  if (!req.auth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // config.matcher below also lists /api/admin/:path* — without checking that prefix
  // here too, every route under it would rely entirely on its own handler for
  // authorization instead of also being covered by this gate.
  if ((pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (
    pathname.startsWith("/facilitator") &&
    role !== "FACILITATOR" &&
    role !== "ADMIN"
  ) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/facilitator/:path*",
    "/admin/:path*",
    "/api/admin/:path*",
  ],
};
