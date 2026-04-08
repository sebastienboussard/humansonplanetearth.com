import Link from "next/link";

export default function Footer() {
  return (
    <footer
      style={{
        backgroundColor: "var(--parchment-dark)",
        borderTop: "1px solid var(--border)",
        color: "var(--muted)",
      }}
      className="px-6 py-8 mt-16"
    >
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <p style={{ fontFamily: "Georgia, serif" }} className="text-sm italic">
          Written by Humans on Planet Earth.
        </p>
        <nav className="flex gap-5 text-xs" style={{ fontFamily: "system-ui, sans-serif" }}>
          <Link href="/about" className="hover:underline">About</Link>
          <Link href="/words" className="hover:underline">Words</Link>
          <Link href="/submit" className="hover:underline">Submit</Link>
          <Link href="/donate" className="hover:underline">Donate</Link>
        </nav>
      </div>
    </footer>
  );
}
