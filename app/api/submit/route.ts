import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";

const MAX_SIZE = 2 * 1024 * 1024; // 2 MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const pdf = formData.get("pdf") as File | null;
    const email = (formData.get("email") as string | null)?.trim().toLowerCase();
    const word = (formData.get("word") as string | null)?.trim().toLowerCase();
    const honeypot = formData.get("_trap") as string | null;

    // Bot check
    if (honeypot) {
      return NextResponse.json({ ok: true }); // silently discard
    }

    if (!pdf || !email || !word) {
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
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse");
    const parsed = await pdfParse(buffer);
    if (parsed.numpages > 1) {
      return NextResponse.json(
        { error: `Your PDF is ${parsed.numpages} pages. Maximum is 1 page.` },
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

    // Check for duplicate submission
    const { data: existing } = await admin
      .from("papers")
      .select("id")
      .eq("email", email)
      .eq("word_id", wordRow.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "You have already submitted a paper for this word." },
        { status: 409 }
      );
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
      email,
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
