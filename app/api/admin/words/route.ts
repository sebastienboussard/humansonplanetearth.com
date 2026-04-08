import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getAdminClient } from "@/lib/supabase";

function getSessionToken() {
  return crypto
    .createHmac("sha256", process.env.ADMIN_PASSWORD ?? "unset")
    .update("hope-admin-session")
    .digest("hex");
}

function isAuthed(req: NextRequest) {
  return req.cookies.get("admin_session")?.value === getSessionToken();
}

export async function POST(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { word, month, year, deadline } = await req.json();

  if (!word || !month || !year || !deadline) {
    return NextResponse.json({ error: "All fields are required." }, { status: 400 });
  }

  const monthNum = parseInt(month, 10);
  const yearNum = parseInt(year, 10);

  if (monthNum < 1 || monthNum > 12 || yearNum < 2020) {
    return NextResponse.json({ error: "Invalid month or year." }, { status: 400 });
  }

  const admin = getAdminClient();
  const { error } = await admin.from("words").insert({
    word: word.toLowerCase().trim(),
    month: monthNum,
    year: yearNum,
    deadline,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
