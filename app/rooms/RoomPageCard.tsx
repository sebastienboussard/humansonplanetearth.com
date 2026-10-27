import Margins from "@/components/Margins";
import type { RoomPageRow } from "@/lib/room-data";

// One page in a Reading Room: the pull-quote it answers, if any, then the
// writing, then its margins. Published as Human On Planet Earth, always.

const sans = { fontFamily: "system-ui, sans-serif" } as const;

export default function RoomPageCard({ page }: { page: RoomPageRow }) {
  return (
    <article className="py-6" style={{ borderTop: "1px solid var(--border)" }}>
      {page.quote && (
        <blockquote className="mb-4 pl-4 italic" style={{ borderLeft: "3px solid var(--terracotta)", color: "var(--muted)" }}>
          &ldquo;{page.quote}&rdquo;
          {page.locator && (
            <span className="not-italic text-xs ml-2" style={sans}>
              ({page.locator})
            </span>
          )}
        </blockquote>
      )}
      <h3 className="text-lg font-normal mb-2" style={{ color: "var(--forest)" }}>
        {page.title}
      </h3>
      <p className="leading-relaxed" style={{ color: "var(--ink)", whiteSpace: "pre-wrap" }}>
        {page.body}
      </p>
      <p className="text-xs mt-3" style={{ ...sans, color: "var(--muted)" }}>
        Human On Planet Earth
      </p>
      <Margins pageId={page.id} />
    </article>
  );
}
