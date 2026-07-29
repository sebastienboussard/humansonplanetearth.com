import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, PDFName, PDFRef } from "pdf-lib";
import { getAdminClient } from "@/lib/supabase";
import { parseTags } from "@/lib/tags";
import { getSessionUser, ensureProfile } from "@/lib/profile";

const MAX_SIZE = 2 * 1024 * 1024; // 2 MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const pdf = formData.get("pdf") as File | null;
    const word = (formData.get("word") as string | null)?.trim().toLowerCase();
    const tags = parseTags(formData.get("tags") as string | null);
    const honeypot = formData.get("_trap") as string | null;

    // Bot check
    if (honeypot) {
      return NextResponse.json({ ok: true }); // silently discard
    }

    if (!pdf || !word) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    if (pdf.type !== "application/pdf") {
      return NextResponse.json({ error: "Only PDF files are accepted." }, { status: 400 });
    }

    if (pdf.size > MAX_SIZE) {
      return NextResponse.json({ error: "File must be under 2 MB." }, { status: 400 });
    }

    // Page count check
    const buffer = Buffer.from(await pdf.arrayBuffer());
    const pdfDoc = await PDFDocument.load(buffer);
    const pageCount = pdfDoc.getPageCount();
    if (pageCount > 1) {
      return NextResponse.json(
        { error: `Your PDF is ${pageCount} pages. Maximum is 1 page.` },
        { status: 400 }
      );
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
      return NextResponse.json({ error: "File must be under 2 MB." }, { status: 400 });
    }

    const admin = getAdminClient();

    // Look up the word row
    const { data: wordRow, error: wordErr } = await admin
      .from("words")
      .select("id")
      .eq("word", word)
      .single();

    if (wordErr || !wordRow) {
      return NextResponse.json({ error: "Word not found." }, { status: 404 });
    }

    // Upload PDF to Supabase Storage
    const filename = `${wordRow.id}/${Date.now()}.pdf`;
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
        word_id: wordRow.id,
        type: "word",
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
    console.error("Submit route error:", err);
    return NextResponse.json({ error: "Server error. Please try again." }, { status: 500 });
  }
}
