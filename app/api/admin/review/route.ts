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

// GET — list pending papers with signed PDF URLs
export async function GET(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const admin = getAdminClient();

  const { data: papers, error } = await admin
    .from("papers")
    .select("id, word_id, type, title, pdf_url, submitted_at, words(word, month, year)")
    .eq("status", "pending")
    .order("submitted_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const enriched = await Promise.all(
    (papers ?? []).map(async (p) => {
      const { data: signed } = await admin.storage
        .from("papers")
        .createSignedUrl(p.pdf_url, 60 * 60 * 2);
      return { ...p, signed_url: signed?.signedUrl ?? null };
    })
  );

  return NextResponse.json({ papers: enriched });
}

// PATCH — approve or reject a paper
export async function PATCH(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id, status } = await req.json();

  if (!id || !["approved", "rejected"].includes(status)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const admin = getAdminClient();
  const { error } = await admin.from("papers").update({ status }).eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
