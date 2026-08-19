import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { isAdminRequest as isAuthed } from "@/lib/admin-auth";

/**
 * Best-effort storage removal. The file may already be gone, and neither
 * deleting nor rejecting a paper should fail because the bucket did — the
 * database is the record of truth about what is published.
 */
async function removeStoredPdf(path: string) {
  try {
    const { error } = await getAdminClient().storage.from("papers").remove([path]);
    if (error) console.error("Storage removal failed:", path, error.message);
  } catch (err) {
    console.error("Storage removal failed:", path, err);
  }
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

  // Row first, then the file. A stray orphaned PDF is a smaller problem than a
  // live row pointing at storage that no longer exists.
  const { error } = await admin.from("papers").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await removeStoredPdf(paper.pdf_url);

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

  // Rejecting used to leave the PDF sitting in the bucket forever. Read the
  // path before the update, because after it the row is still there but the
  // file should not be.
  let pdfUrl: string | null = null;
  if (status === "rejected") {
    const { data: paper } = await admin.from("papers").select("pdf_url").eq("id", id).single();
    pdfUrl = paper?.pdf_url ?? null;
  }

  const { error } = await admin.from("papers").update({ status }).eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (pdfUrl) await removeStoredPdf(pdfUrl);

  return NextResponse.json({ ok: true });
}
