import Link from "next/link";
import { notFound } from "next/navigation";
import { describeWork, getRoom, pageCounts } from "@/lib/room-data";
import { linkLabel } from "@/lib/rooms";
import RoomSections from "../RoomSections";

export const revalidate = 60;

const sans = { fontFamily: "system-ui, sans-serif" } as const;

export default async function RoomPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const found = await getRoom(slug);
  if (!found) notFound();
  const { room, sections } = found;
  const counts = await pageCounts(sections.map((s) => s.id));

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <Link href="/rooms" className="text-xs underline underline-offset-4" style={{ ...sans, color: "var(--muted)" }}>
        ← All rooms
      </Link>
      <h1 className="text-4xl font-normal mt-4 mb-1" style={{ color: "var(--forest)" }}>
        {room.title}
      </h1>
      <p className="text-sm mb-6" style={{ ...sans, color: "var(--muted)" }}>{describeWork(room)}</p>
      {room.intro && (
        <p className="leading-relaxed mb-10" style={{ color: "var(--ink)", whiteSpace: "pre-wrap" }}>{room.intro}</p>
      )}
      {/* Added by whoever opened the room; only http(s), checked in the route
          and the database (migration 0008). nofollow ugc: they're not ours. */}
      {room.links && room.links.length > 0 && (
        <div className="mb-10">
          <p className="text-xs uppercase tracking-widest mb-2" style={{ ...sans, color: "var(--muted)" }}>
            Where to find it
          </p>
          <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm" style={sans}>
            {room.links.map((link) => (
              <li key={link.url}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="nofollow ugc noopener noreferrer"
                  className="underline underline-offset-4"
                  style={{ color: "var(--terracotta)" }}
                >
                  {linkLabel(link.url)} ↗
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs mb-4" style={{ ...sans, color: "var(--muted)" }}>
        Every part starts closed, so nothing ahead of where you are can catch your eye. Open the one you&apos;ve reached.
      </p>
      <RoomSections
        slug={room.slug}
        sections={sections.map((s) => ({ ...s, count: counts[s.id] ?? 0 }))}
      />
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const found = await getRoom(slug);
  return { title: `${found?.room.title ?? "Reading Room"} — Humans on Planet Earth` };
}
