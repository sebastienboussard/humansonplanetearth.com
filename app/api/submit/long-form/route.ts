import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, PDFName, PDFRef } from "pdf-lib";
import { getAdminClient } from "@/lib/supabase";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const pdf = formData.get("pdf") as File | null;
    const title = (formData.get("title") as string | null)?.trim();
    const honeypot = formData.get("_trap") as string | null;

    if (honeypot) return NextResponse.json({ ok: true });

    if (!pdf || !title) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    if (pdf.type !== "application/pdf") {
      return NextResponse.json({ error: "Only PDF files are accepted." }, { status: 400 });
    }

    if (pdf.size > MAX_SIZE) {
      return NextResponse.json({ error: "File must be under 10 MB." }, { status: 400 });
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
      return NextResponse.json({ error: "File must be under 10 MB." }, { status: 400 });
    }

    const admin = getAdminClient();

    // Upload PDF to Supabase Storage
    const filename = `long-form/${Date.now()}.pdf`;
    const { error: uploadErr } = await admin.storage
      .from("papers")
      .upload(filename, cleanBuffer, { contentType: "application/pdf", upsert: false });

    if (uploadErr) {
      console.error("Storage upload error:", uploadErr);
      return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
    }

    // Insert paper row
    const { error: insertErr } = await admin.from("papers").insert({
      word_id: null,
      type: "long-form",
      title,
      pdf_url: filename,
      status: "pending",
    });

    if (insertErr) {
      console.error("DB insert error:", insertErr);
      return NextResponse.json({ error: "Submission failed. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Long-form submit error:", err);
    return NextResponse.json({ error: "Server error. Please try again." }, { status: 500 });
  }
}
