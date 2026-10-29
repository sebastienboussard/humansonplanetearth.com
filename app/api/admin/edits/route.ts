import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { isAdminRequest as isAuthed } from "@/lib/admin-auth";
import { removeStoredPdf } from "@/lib/storage-cleanup";

// Change requests on papers (TODO §24). Authors send a replacement PDF from
// their account; the admin applies or declines it here. Nothing about who
// asked reaches this route — the request rows carry no author.

type RequestRow = {
  id: string;
  note: string | null;
  pdf_path: string;
  created_at: string;
  papers: {
    id: string;
    type: string;
    title: string | null;
    status: string;
    pdf_url: string;
    words: { word: string; month: number; year: number } | null;
  } | null;
};

// GET — pending requests, oldest first, like the pending papers queue
export async function GET(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("paper_edit_requests")
    .select("id, note, pdf_path, created_at, papers(id, type, title, status, pdf_url, words(word, month, year))")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const url = (path: string) => admin.storage.from("papers").getPublicUrl(path).data.publicUrl;

  const edits = ((data ?? []) as RequestRow[])
    .filter((r) => r.papers)
    .map((r) => ({
      id: r.id,
      note: r.note,
      created_at: r.created_at,
      paper: {
        id: r.papers!.id,
        type: r.papers!.type,
        title: r.papers!.title,
        status: r.papers!.status,
        words: r.papers!.words,
      },
      current_url: url(r.papers!.pdf_url),
      replacement_url: url(r.pdf_path),
    }));

  return NextResponse.json({ edits });
}

// PATCH — apply or decline one request
export async function PATCH(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id, decision } = await req.json();
  if (!id || !["apply", "decline"].includes(decision)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const admin = getAdminClient();

  if (decision === "apply") {
    // One transaction in the database (migration 0010): the paper points at
    // the new file and the request is marked applied, or neither happens.
    const { data: oldPath, error } = await admin.rpc("apply_paper_edit", { p_request: id });
    if (error) {
      console.error("Apply change error:", error);
      return NextResponse.json(
        { error: "This change can no longer be applied. Reload to see where it stands." },
        { status: 409 }
      );
    }
    // Row first, then the file, as in the review route.
    if (typeof oldPath === "string" && oldPath) await removeStoredPdf(oldPath);
    return NextResponse.json({ ok: true });
  }

  const { data: request } = await admin
    .from("paper_edit_requests")
    .select("id, pdf_path, status")
    .eq("id", id)
    .maybeSingle();

  if (!request) return NextResponse.json({ error: "Change request not found." }, { status: 404 });
  if (request.status !== "pending") {
    return NextResponse.json({ error: "This change has already been decided." }, { status: 409 });
  }

  // Guarded on status, so a decline racing an apply cannot undo it.
  const { data: updated, error } = await admin
    .from("paper_edit_requests")
    .update({ status: "declined", decided_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending")
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!updated || (updated as unknown[]).length === 0) {
    return NextResponse.json({ error: "This change has already been decided." }, { status: 409 });
  }

  await removeStoredPdf(request.pdf_path);
  return NextResponse.json({ ok: true });
}
