import { NextResponse } from "next/server";

export async function GET() {
  const res = NextResponse.redirect(
    new URL("/admin", process.env.NEXT_PUBLIC_SUPABASE_URL ? "https://humansonplanetearth.com" : "http://localhost:3000")
  );
  res.cookies.set("admin_session", "", { maxAge: 0, path: "/" });
  return res;
}
