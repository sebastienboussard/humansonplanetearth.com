import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import crypto from "crypto";

function getSessionToken() {
  return crypto
    .createHmac("sha256", process.env.ADMIN_PASSWORD ?? "unset")
    .update("hope-admin-session")
    .digest("hex");
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only protect /admin/* (but not /admin login page itself)
  if (pathname.startsWith("/admin") && pathname !== "/admin") {
    const cookie = req.cookies.get("admin_session")?.value;
    if (cookie !== getSessionToken()) {
      return NextResponse.redirect(new URL("/admin", req.url));
    }
    return NextResponse.next();
  }

  // /account and /auth: refresh the Supabase auth session so expired access
  // tokens are renewed before the page or route handler reads them.
  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          );
        },
      },
    }
  );
  await supabase.auth.getUser();

  return res;
}

export const config = {
  matcher: ["/admin/:path+", "/account/:path*", "/auth/:path*"],
};
