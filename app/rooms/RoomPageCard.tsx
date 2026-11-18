import Margins from "@/components/Margins";
import type { RoomPageRow } from "@/lib/room-data";

// One page in a Reading Room, in its own card so pages can be told apart: its
// place in the section, the pull-quote it answers, if any, then the writing,
// then its margins, folded away. Published as Human On Planet Earth, always.
//
// The anchor is the page's place (#page-3), not its id, so it reads well when
// shared. An older page approved late can shift the numbers; that only moves
// a jump within the section, which is acceptable.

const sans = { fontFamily: "system-ui, sans-serif" } as const;

export function pageAnchor(n: number): string {
  return `page-${n}`;
}

export default function RoomPageCard({
  page,
  n,
  total,
  marginCount,
  listed,
}: {
  page: RoomPageRow;
  n: number;
  total: number;
  marginCount: number;
  /** Whether the section shows its list of pages, for the "All pages" link. */
  listed: boolean;
}) {
  return (
    <article
      id={pageAnchor(n)}
      className="p-6 rounded-sm scroll-mt-6"
      style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
    >
      <div className="flex justify-between gap-4 mb-4 text-xs" style={{ ...sans, color: "var(--muted)" }}>
        <span>
          Page {n} of {total}
        </span>
        <time dateTime={page.submitted_at}>
          {new Date(page.submitted_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </time>
      </div>
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
      {page.title && (
        <h2 className="text-xl font-normal mb-2" style={{ color: "var(--forest)" }}>
          {page.title}
        </h2>
      )}
      <p className="leading-relaxed" style={{ color: "var(--ink)", whiteSpace: "pre-wrap" }}>
        {page.body}
      </p>
      <div className="flex flex-wrap gap-x-5 gap-y-1 mt-4 text-xs" style={{ ...sans, color: "var(--muted)" }}>
        <span className="w-full sm:w-auto sm:mr-auto">Human On Planet Earth</span>
        {listed && (
          <a href="#pages" className="underline underline-offset-4">
            ↑ All pages
          </a>
        )}
        {n < total && (
          <a href={`#${pageAnchor(n + 1)}`} className="underline underline-offset-4">
            Next page ↓
          </a>
        )}
      </div>
      <Margins pageId={page.id} count={marginCount} />
    </article>
  );
}
