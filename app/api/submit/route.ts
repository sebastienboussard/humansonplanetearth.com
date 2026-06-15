import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { getAdminClient } from "@/lib/supabase";

const MAX_SIZE = 2 * 1024 * 1024; // 2 MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const pdf = formData.get("pdf") as File | null;
    const word = (formData.get("word") as string | null)?.trim().toLowerCase();
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
      .upload(filename, buffer, { contentType: "application/pdf", upsert: false });

    if (uploadErr) {
      console.error("Storage upload error:", uploadErr);
      return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
    }

    // Insert paper row
    const { error: insertErr } = await admin.from("papers").insert({
      word_id: wordRow.id,
      type: "word",
      pdf_url: filename,
      status: "pending",
    });

    if (insertErr) {
      console.error("DB insert error:", insertErr);
      return NextResponse.json({ error: "Submission failed. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Submit route error:", err);
    return NextResponse.json({ error: "Server error. Please try again." }, { status: 500 });
  }
}
