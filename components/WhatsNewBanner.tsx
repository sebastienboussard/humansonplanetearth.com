import Link from "next/link";
import { WHATS_NEW } from "@/data/whats-new";

// Formats the hardcoded ISO date in UTC so "2026-08-01" never renders as Jul 31.
function formatEntryDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

// Native <details>/<summary> keeps this a server component: no hydration, and
// the banner still expands with JavaScript disabled.
export default function WhatsNewBanner() {
  if (WHATS_NEW.length === 0) return null;

  return (
    <details className="group text-center mb-12">
      <summary
        className="inline-block cursor-pointer list-none [&::-webkit-details-marker]:hidden text-xs underline decoration-dotted underline-offset-4"
        style={{ fontFamily: "system-ui, sans-serif", color: "var(--terracotta)" }}
      >
        What&rsquo;s new on the site{" "}
        <span aria-hidden="true" className="group-open:hidden">
          +
        </span>
        <span aria-hidden="true" className="hidden group-open:inline">
          −
        </span>
      </summary>

      <div
        className="mt-4 mx-auto max-w-xl text-left px-6 py-5"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
      >
        <ul className="space-y-4">
          {WHATS_NEW.map((entry) => (
            <li key={entry.title}>
              <p
                className="text-xs mb-1"
                style={{ fontFamily: "system-ui, sans-serif", color: "var(--muted)" }}
              >
                {formatEntryDate(entry.date)}
              </p>
              <p className="text-sm leading-relaxed" style={{ color: "var(--ink)" }}>
                <strong className="font-semibold" style={{ color: "var(--forest)" }}>
                  {entry.title}.
                </strong>{" "}
                {entry.blurb}
                {entry.href && (
                  <>
                    {" "}
                    <Link
                      href={entry.href}
                      className="underline underline-offset-4 whitespace-nowrap"
                      style={{ color: "var(--terracotta)", fontFamily: "system-ui, sans-serif" }}
                    >
                      See it →
                    </Link>
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
