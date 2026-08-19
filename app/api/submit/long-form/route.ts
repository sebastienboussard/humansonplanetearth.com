import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { PDFDocument, PDFName, PDFRef } from "pdf-lib";
import { getAdminClient } from "@/lib/supabase";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { LONG_FORM_MAX_SIZE } from "@/lib/upload-limits";
import { parseTags } from "@/lib/tags";
import { getSessionUser, ensureProfile } from "@/lib/profile";
import { notifyAdminNewPaper } from "@/lib/admin-alerts";

// 4 MB, not 10. Vercel caps a serverless request body at ~4.5 MB, and
// `req.formData()` buffers the entire request before any check below can run —
// so a genuine 10 MB upload died at the platform boundary with a generic error
// instead of ours. Shared with the form so the two cannot drift.
const MAX_SIZE = LONG_FORM_MAX_SIZE;

// Long-form papers are a bigger ask to review, so the hourly allowance is
// tighter than the one-page word route.
const MAX_UPLOADS = 3;
const WINDOW_SECONDS = 60 * 60;

export async function POST(req: NextRequest) {
  try {
    const limit = await rateLimit(`submit-long-form:${clientIp(req)}`, MAX_UPLOADS, WINDOW_SECONDS);
    if (!limit.allowed) {
      return tooManyRequests(
        limit.retryAfter,
        "You have submitted several papers already. Please try again later."
      );
    }

    // Reject on the declared length before buffering the body, so an oversized
    // upload fails fast rather than after we have read all of it.
    const declared = Number(req.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_SIZE) {
      return NextResponse.json({ error: "File must be under 4 MB." }, { status: 413 });
    }

    const formData = await req.formData();
    const pdf = formData.get("pdf") as File | null;
    const title = (formData.get("title") as string | null)?.trim();
    const tags = parseTags(formData.get("tags") as string | null);
    const honeypot = formData.get("_trap") as string | null;

    if (honeypot) return NextResponse.json({ ok: true });

    if (!pdf || !title) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    if (pdf.type !== "application/pdf") {
      return NextResponse.json({ error: "Only PDF files are accepted." }, { status: 400 });
    }

    if (pdf.size > MAX_SIZE) {
      return NextResponse.json({ error: "File must be under 4 MB." }, { status: 400 });
    }

    // Validate it's actually a PDF
    const buffer = Buffer.from(await pdf.arrayBuffer());
    let pdfDoc: PDFDocument;
    try {
      pdfDoc = await PDFDocument.load(buffer);
    } catch {
      return NextResponse.json({ error: "Invalid PDF file." }, { status: 400 });
    }

    // Strip identifying metadata before storing (anonymity).
    // Never fall back to uploading the original un-stripped bytes.
    let cleanBuffer: Buffer;
    try {
      pdfDoc.setTitle("");
      pdfDoc.setAuthor("");
      pdfDoc.setSubject("");
      pdfDoc.setKeywords([]);
      pdfDoc.setProducer("");
      pdfDoc.setCreator("");
      pdfDoc.setCreationDate(new Date(0));
      pdfDoc.setModificationDate(new Date(0));

      // Remove the XMP metadata stream — delete the object itself, not just the
      // catalog reference (pdf-lib doesn't garbage-collect orphaned objects).
      const metaRef = pdfDoc.catalog.get(PDFName.of("Metadata"));
      pdfDoc.catalog.delete(PDFName.of("Metadata"));
      if (metaRef instanceof PDFRef) pdfDoc.context.delete(metaRef);

      const cleanBytes = await pdfDoc.save({ updateFieldAppearances: false });
      cleanBuffer = Buffer.from(cleanBytes);
    } catch (err) {
      console.error("PDF sanitization failed:", err);
      return NextResponse.json(
        { error: "Could not process this PDF. Please try a different file." },
        { status: 400 }
      );
    }

    // Re-check size — re-saving can grow the file past the limit
    if (cleanBuffer.length > MAX_SIZE) {
      return NextResponse.json({ error: "File must be under 4 MB." }, { status: 400 });
    }

    const admin = getAdminClient();

    // Upload PDF to Supabase Storage
    // randomUUID, not Date.now(): timestamps collide under concurrent uploads
    // and leak submission times to anyone who can see a storage path.
    const filename = `long-form/${crypto.randomUUID()}.pdf`;
    const { error: uploadErr } = await admin.storage
      .from("papers")
      .upload(filename, cleanBuffer, { contentType: "application/pdf", upsert: false });

    if (uploadErr) {
      console.error("Storage upload error:", uploadErr);
      return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
    }

    // Insert paper row
    const { data: paper, error: insertErr } = await admin
      .from("papers")
      .insert({
        word_id: null,
        type: "long-form",
        title,
        pdf_url: filename,
        status: "pending",
        tags,
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error("DB insert error:", insertErr);
      return NextResponse.json({ error: "Submission failed. Please try again." }, { status: 500 });
    }

    // Alert the admin inbox — failure must not fail the submission.
    try {
      await notifyAdminNewPaper({ type: "long-form", word: null, title });
    } catch (err) {
      console.error("Admin alert error:", err);
    }

    // Optional profile attachment — always derived from the server-side session,
    // never from a client-sent id. Failure must not fail the submission.
    if (formData.get("attach") === "1" && paper) {
      try {
        const user = await getSessionUser();
        const profile = user ? await ensureProfile(user) : null;
        if (profile) {
          const { error: attachErr } = await admin
            .from("paper_authors")
            .insert({ paper_id: paper.id, profile_id: profile.id, public_visible: false });
          if (attachErr) console.error("Paper attach error:", attachErr);
        }
      } catch (err) {
        console.error("Paper attach error:", err);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Long-form submit error:", err);
    return NextResponse.json({ error: "Server error. Please try again." }, { status: 500 });
  }
}
