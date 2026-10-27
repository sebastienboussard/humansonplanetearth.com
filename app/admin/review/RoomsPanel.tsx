"use client";

import Link from "next/link";
import { useAdminData } from "./AdminData";

// Reading Rooms moderation (TODO §21). Pages wait here until approved; rooms
// go live at once and can be taken down here. Nothing shows who wrote what,
// because the API doesn't send it.

const sans = { fontFamily: "system-ui, sans-serif" } as const;
const card = { backgroundColor: "var(--card)", border: "1px solid var(--border)" } as const;

export default function RoomsPanel() {
  const { roomPages, liveRooms, loading, decideRoomPage, removeRoom } = useAdminData();

  return (
    <div className="space-y-12">
      <section>
        <h2 className="text-lg font-normal mb-4" style={{ color: "var(--forest)" }}>Pages waiting for review</h2>
        {loading.rooms ? (
          <p className="text-sm italic" style={{ ...sans, color: "var(--muted)" }}>Loading…</p>
        ) : roomPages.length === 0 ? (
          <p className="text-sm" style={{ ...sans, color: "var(--muted)" }}>Nothing waiting.</p>
        ) : (
          <ul className="space-y-4">
            {roomPages.map((page) => (
              <li key={page.id} className="p-5 rounded-sm" style={card}>
                <p className="text-xs mb-2" style={{ ...sans, color: "var(--muted)" }}>
                  {page.room_sections?.rooms?.title ?? "Unknown room"} · {page.room_sections?.label ?? "?"}
                </p>
                {page.quote && (
                  <blockquote className="mb-2 pl-3 italic text-sm" style={{ borderLeft: "3px solid var(--terracotta)", color: "var(--muted)" }}>
                    &ldquo;{page.quote}&rdquo;{page.locator ? ` (${page.locator})` : ""}
                  </blockquote>
                )}
                <p className="text-base mb-1" style={{ color: "var(--forest)" }}>{page.title}</p>
                <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--ink)", whiteSpace: "pre-wrap" }}>{page.body}</p>
                <div className="flex gap-4 text-sm" style={sans}>
                  <button onClick={() => void decideRoomPage(page.id, "approved")} style={{ color: "var(--forest)" }} className="underline">
                    Approve
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Reject "${page.title}"? It won't be published.`)) void decideRoomPage(page.id, "rejected");
                    }}
                    style={{ color: "var(--terracotta)" }}
                    className="underline"
                  >
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-normal mb-4" style={{ color: "var(--forest)" }}>Live rooms</h2>
        {loading.rooms ? null : liveRooms.length === 0 ? (
          <p className="text-sm" style={{ ...sans, color: "var(--muted)" }}>No rooms yet.</p>
        ) : (
          <ul className="space-y-2">
            {liveRooms.map((room) => (
              <li key={room.id} className="flex items-center justify-between gap-4 px-5 py-3 rounded-sm" style={card}>
                <Link href={`/rooms/${room.slug}`} className="underline underline-offset-4" style={{ color: "var(--forest)" }}>
                  {room.title}
                </Link>
                <button
                  onClick={() => {
                    if (confirm(`Take "${room.title}" down? It will stop being visible to everyone.`)) void removeRoom(room.id);
                  }}
                  className="text-sm underline"
                  style={{ ...sans, color: "var(--terracotta)" }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
