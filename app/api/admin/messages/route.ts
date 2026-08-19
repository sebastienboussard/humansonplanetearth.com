import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { isAdminRequest as isAuthed } from "@/lib/admin-auth";

// GET — list messages, newest first
export async function GET(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("messages")
    .select("id, body, reply_email, read, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ messages: data ?? [] });
}

// PATCH — mark read/unread
export async function PATCH(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id, read } = await req.json();
  if (!id || typeof read !== "boolean") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const admin = getAdminClient();
  const { error } = await admin.from("messages").update({ read }).eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE — permanently remove
export async function DELETE(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const admin = getAdminClient();
  const { error } = await admin.from("messages").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
