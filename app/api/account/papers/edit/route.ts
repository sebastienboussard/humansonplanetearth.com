import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { PDFDocument } from "pdf-lib";
import { getAdminClient } from "@/lib/supabase";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import {
  LONG_FORM_MAX_SIZE,
  MAX_UPLOAD_SIZE,
  WORD_MAX_SIZE,
  formatBytes,
  oversizeMessage,
} from "@/lib/upload-limits";
import { getSessionUser, ensureProfile } from "@/lib/profile";
import { notifyAdminPaperEdit } from "@/lib/admin-alerts";
import { discardOrphanedUpload } from "@/lib/storage-cleanup";
import { stripPdfMetadata } from "@/lib/pdf-sanitize";

// Change requests (TODO §24): the author of a paper attached to their account
// sends a replacement PDF, and the admin applies it. Nothing public changes
// here — the paper keeps its current file until the admin says otherwise.

// Matches the check in migration 0010.
const NOTE_MAX = 1000;

// Five requests an hour per IP. This limit fails open (lib/rate-limit.ts),
// which is safe here because it is not the boundary: the ownership check
// below is, and that one fails closed.
const MAX_REQUESTS = 5;
const WINDOW_SECONDS = 60 * 60;

// Where a request's file is claimed, for cleanup after a failed insert.
const CLAIMED_BY = { table: "paper_edit_requests", column: "pdf_path" };

type OwnedPaper = {
  paper_id: string;
  papers: {
    id: string;
    type: "word" | "long-form";
    title: string | null;
    status: string;
    pdf_url: string;
    words: { word: string } | null;
  } | null;
};

export async function POST(req: NextRequest) {
  // Set once the file is in the bucket. Every failure after that owes the
  // bucket a cleanup, as in the submit routes.
  let uploadedPath: string | null = null;

  try {
    const limit = await rateLimit(`paper-edit:${clientIp(req)}`, MAX_REQUESTS, WINDOW_SECONDS);
    if (!limit.allowed) {
      return tooManyRequests(
        limit.retryAfter,
        "You have sent several change requests already. Please try again later."
      );
    }

    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    const declared = Number(req.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_UPLOAD_SIZE) {
      return NextResponse.json(
        { error: `That upload is over the ${formatBytes(MAX_UPLOAD_SIZE)} limit. Compress the PDF and try again.` },
        { status: 413 }
      );
    }

    const formData = await req.formData();
    const paperId = (formData.get("paperId") as string | null)?.trim();
    const pdf = formData.get("pdf") as File | null;
    const note = (formData.get("note") as string | null)?.trim() || null;

    if (!paperId || !pdf) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }
    if (note && note.length > NOTE_MAX) {
      return NextResponse.json(
        { error: `Keep the note under ${NOTE_MAX} characters.` },
        { status: 400 }
      );
    }

    const profile = await ensureProfile(user);
    if (!profile) {
      return NextResponse.json({ error: "Profile unavailable. Please try again." }, { status: 500 });
    }

    const admin = getAdminClient();

    // The boundary. Only a paper linked to this profile is found, so someone
    // else's paper and a paper that does not exist both get the same 404 —
    // nothing here confirms that a paper id is real. A failed lookup is also
    // a 404: this fails closed.
    const { data: owned, error: ownErr } = await admin
      .from("paper_authors")
      .select("paper_id, papers(id, type, title, status, pdf_url, words(word))")
      .eq("paper_id", paperId)
      .eq("profile_id", profile.id)
      .maybeSingle();

    const paper = (owned as OwnedPaper | null)?.papers ?? null;
    if (ownErr || !paper) {
      return NextResponse.json({ error: "Paper not found." }, { status: 404 });
    }

    // A rejected paper's file is already gone and it will never be shown.
    if (paper.status === "rejected") {
      return NextResponse.json(
        { error: "This paper was not published, so it cannot be changed." },
        { status: 409 }
      );
    }

    const { data: open } = await admin
      .from("paper_edit_requests")
      .select("id")
      .eq("paper_id", paper.id)
      .eq("status", "pending")
      .limit(1);
    if (open && open.length > 0) {
      return NextResponse.json(
        { error: "A change to this paper is already waiting for review." },
        { status: 409 }
      );
    }

    // The same checks a new submission of this type gets.
    const maxSize = paper.type === "long-form" ? LONG_FORM_MAX_SIZE : WORD_MAX_SIZE;

    if (pdf.type !== "application/pdf") {
      return NextResponse.json({ error: "Only PDF files are accepted." }, { status: 400 });
    }
    if (pdf.size > maxSize) {
      return NextResponse.json({ error: oversizeMessage(pdf.size, maxSize) }, { status: 413 });
    }

    const buffer = Buffer.from(await pdf.arrayBuffer());
    let pdfDoc: PDFDocument;
    try {
      pdfDoc = await PDFDocument.load(buffer);
    } catch {
      return NextResponse.json({ error: "Invalid PDF file." }, { status: 400 });
    }

    if (paper.type === "word") {
      const pageCount = pdfDoc.getPageCount();
      if (pageCount > 1) {
        return NextResponse.json(
          { error: `Your PDF is ${pageCount} pages. Maximum is 1 page.` },
          { status: 400 }
        );
      }
    }

    // Never fall back to uploading the original un-stripped bytes.
    let cleanBuffer: Buffer;
    try {
      cleanBuffer = await stripPdfMetadata(pdfDoc);
    } catch (err) {
      console.error("PDF sanitization failed:", err);
      return NextResponse.json(
        { error: "Could not process this PDF. Please try a different file." },
        { status: 400 }
      );
    }

    if (cleanBuffer.length > maxSize) {
      return NextResponse.json(
        {
          error: `That file sits right at the ${formatBytes(
            maxSize
          )} limit and grew past it once its metadata was stripped. Compress it a little further and try again.`,
        },
        { status: 413 }
      );
    }

    // Next to the file it would replace — the word's folder, or long-form/ —
    // so the bucket keeps one layout. A fresh name, never the old one: the
    // old file stays live until the admin applies the change.
    const slash = paper.pdf_url.lastIndexOf("/");
    const folder = slash > 0 ? paper.pdf_url.slice(0, slash) : "edits";
    const filename = `${folder}/${crypto.randomUUID()}.pdf`;

    const { error: uploadErr } = await admin.storage
      .from("papers")
      .upload(filename, cleanBuffer, { contentType: "application/pdf", upsert: false });
    if (uploadErr) {
      console.error("Storage upload error:", uploadErr);
      return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
    }

    uploadedPath = filename;

    const { error: insertErr } = await admin
      .from("paper_edit_requests")
      .insert({ paper_id: paper.id, pdf_path: filename, note });

    if (insertErr) {
      await discardOrphanedUpload(filename, CLAIMED_BY);
      uploadedPath = null;
      // 23505: the one-pending-per-paper index caught a request that landed
      // between the check above and this insert.
      if ((insertErr as { code?: string }).code === "23505") {
        return NextResponse.json(
          { error: "A change to this paper is already waiting for review." },
          { status: 409 }
        );
      }
      console.error("Change request insert error:", insertErr);
      return NextResponse.json({ error: "Could not send the request. Please try again." }, { status: 500 });
    }

    uploadedPath = null;

    // Failure must not fail the request.
    try {
      await notifyAdminPaperEdit({
        type: paper.type,
        word: paper.words?.word ?? null,
        title: paper.title,
      });
    } catch (err) {
      console.error("Admin alert error:", err);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Change request route error:", err);
    if (uploadedPath) await discardOrphanedUpload(uploadedPath, CLAIMED_BY);
    return NextResponse.json({ error: "Server error. Please try again." }, { status: 500 });
  }
}
