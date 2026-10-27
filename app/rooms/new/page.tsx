import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase-server";
import NewRoomForm from "./NewRoomForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Open a Reading Room — Humans on Planet Earth",
};

const sans = { fontFamily: "system-ui, sans-serif" } as const;

// Opening a room needs an account (TODO §21); writing in one doesn't.
export default async function NewRoomPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <Link href="/rooms" className="text-xs underline underline-offset-4" style={{ ...sans, color: "var(--muted)" }}>
        ← All rooms
      </Link>
      <h1 className="text-4xl font-normal mt-4 mb-2" style={{ color: "var(--forest)" }}>
        Open a Reading Room
      </h1>
      <p className="text-sm mb-10" style={{ ...sans, color: "var(--muted)" }}>
        Choose a book or a film, break it into the parts you want people to write about, and it goes up straight away.
        Anyone can write in it. Nobody needs an account but you.
      </p>
      {user ? (
        <NewRoomForm />
      ) : (
        <p className="text-sm" style={{ ...sans, color: "var(--ink)" }}>
          <Link href="/account" className="underline underline-offset-4" style={{ color: "var(--terracotta)" }}>
            Sign in
          </Link>{" "}
          to open a room. It only takes your email, and the room is never shown with your name.
        </p>
      )}
    </div>
  );
}
