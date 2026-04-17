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

// GET — list papers by status (pending by default, or ?status=approved)
export async function GET(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const status = req.nextUrl.searchParams.get("status") ?? "pending";
  if (!["pending", "approved"].includes(status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const admin = getAdminClient();

  const { data: papers, error } = await admin
    .from("papers")
    .select("id, word_id, type, title, pdf_url, submitted_at, words(word, month, year)")
    .eq("status", status)
    .order("submitted_at", { ascending: status === "pending" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const enriched = (papers ?? []).map((p: any) => ({
    ...p,
    signed_url: admin.storage.from("papers").getPublicUrl(p.pdf_url).data.publicUrl,
  }));

  return NextResponse.json({ papers: enriched });
}

// DELETE — permanently remove a paper from DB and storage
export async function DELETE(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const admin = getAdminClient();

  const { data: paper } = await admin
    .from("papers")
    .select("id, pdf_url")
    .eq("id", id)
    .single();

  if (!paper) return NextResponse.json({ error: "Paper not found." }, { status: 404 });

  // Best-effort storage deletion — file may already be gone
  await admin.storage.from("papers").remove([paper.pdf_url]);

  const { error } = await admin.from("papers").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
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
