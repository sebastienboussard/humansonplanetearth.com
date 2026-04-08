import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

function getSessionToken() {
  return crypto
    .createHmac("sha256", process.env.ADMIN_PASSWORD ?? "unset")
    .update("hope-admin-session")
    .digest("hex");
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only protect /admin/* (but not /admin login page itself)
  if (pathname.startsWith("/admin") && pathname !== "/admin") {
    const cookie = req.cookies.get("admin_session")?.value;
    if (cookie !== getSessionToken()) {
      return NextResponse.redirect(new URL("/admin", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path+"],
};
