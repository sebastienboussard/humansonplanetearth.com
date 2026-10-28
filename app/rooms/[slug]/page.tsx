import Link from "next/link";
import { notFound } from "next/navigation";
import { describeWork, getRoom, pageCounts, whereToFind } from "@/lib/room-data";
import { coverUrl } from "@/lib/open-library";
import RoomSections from "../RoomSections";

export const revalidate = 60;

const sans = { fontFamily: "system-ui, sans-serif" } as const;

export default async function RoomPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const found = await getRoom(slug);
  if (!found) notFound();
  const { room, sections } = found;
  const counts = await pageCounts(sections.map((s) => s.id));
  const links = whereToFind(room);

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <Link href="/rooms" className="text-xs underline underline-offset-4" style={{ ...sans, color: "var(--muted)" }}>
        ← All rooms
      </Link>
      <div className="flex gap-5 items-start mt-4 mb-6">
        {/* A plain lazy <img>, not next/image: the cover is Open Library's, and
            proxying it through our optimiser would spend our quota on theirs. */}
        {room.cover_id && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl(room.cover_id, "M")}
            alt=""
            loading="lazy"
            width={80}
            className="rounded-sm shrink-0"
            style={{ border: "1px solid var(--border)" }}
          />
        )}
        <div>
          <h1 className="text-4xl font-normal mb-1" style={{ color: "var(--forest)" }}>
            {room.title}
          </h1>
          <p className="text-sm" style={{ ...sans, color: "var(--muted)" }}>{describeWork(room)}</p>
        </div>
      </div>
      {room.intro && (
        <p className="leading-relaxed mb-10" style={{ color: "var(--ink)", whiteSpace: "pre-wrap" }}>{room.intro}</p>
      )}
      {/* The Open Library work, then links added by whoever opened the room;
          only http(s), checked in the route and the database (migration 0008).
          nofollow ugc: they're not ours. */}
      {links.length > 0 && (
        <div className="mb-10">
          <p className="text-xs uppercase tracking-widest mb-2" style={{ ...sans, color: "var(--muted)" }}>
            Where to find it
          </p>
          <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm" style={sans}>
            {links.map((link) => (
              <li key={link.url}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="nofollow ugc noopener noreferrer"
                  className="underline underline-offset-4"
                  style={{ color: "var(--terracotta)" }}
                >
                  {link.label} ↗
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

      {room.ol_work_key && (
        <p className="text-xs mt-12" style={{ ...sans, color: "var(--muted)" }}>
          Book data from{" "}
          <a href="https://openlibrary.org" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
            Open Library
          </a>
          .
        </p>
      )}
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const found = await getRoom(slug);
  return { title: `${found?.room.title ?? "Reading Room"} — Humans on Planet Earth` };
}
