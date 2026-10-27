import Link from "next/link";
import { describeWork, listRooms } from "@/lib/room-data";

export const revalidate = 60;

export const metadata = {
  title: "Reading Rooms — Humans on Planet Earth",
};

const sans = { fontFamily: "system-ui, sans-serif" } as const;

export default async function RoomsPage() {
  const rooms = await listRooms();

  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-4">
        <h1 className="text-4xl font-normal" style={{ color: "var(--forest)" }}>
          Reading Rooms
        </h1>
        <Link href="/rooms/new" className="text-sm underline underline-offset-4" style={{ ...sans, color: "var(--terracotta)" }}>
          Open a room →
        </Link>
      </div>
      <p className="text-sm mb-12" style={{ ...sans, color: "var(--muted)" }}>
        A book or a film, broken into parts. Read at your own pace, write about the part you&apos;re on,
        and open only the parts you&apos;ve reached.
      </p>

      {rooms.length === 0 ? (
        <div className="py-16 text-center" style={{ ...sans, color: "var(--muted)" }}>
          <p className="text-base mb-1">No rooms yet.</p>
          <p className="text-sm italic">
            <Link href="/rooms/new" className="underline underline-offset-4" style={{ color: "var(--terracotta)" }}>
              Open the first one →
            </Link>
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rooms.map((room) => (
            <li key={room.id}>
              <Link
                href={`/rooms/${room.slug}`}
                className="block px-5 py-4 rounded-sm transition-opacity hover:opacity-80"
                style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
              >
                <p className="text-lg" style={{ color: "var(--forest)" }}>{room.title}</p>
                <p className="text-xs mt-0.5" style={{ ...sans, color: "var(--muted)" }}>{describeWork(room)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
