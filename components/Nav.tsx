"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const links = [
  { href: "/", label: "Home" },
  { href: "/words", label: "Words" },
  { href: "/long-form", label: "Long-Form" },
  { href: "/submit", label: "Submit" },
  { href: "/about", label: "About" },
  { href: "/donate", label: "Donate" },
];

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <nav
      style={{ backgroundColor: "var(--forest)", borderBottom: "2px solid var(--terracotta)" }}
      className="px-6 py-4"
    >
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <Link
          href="/"
          className="text-white text-lg tracking-wide hover:opacity-80 transition-opacity"
          style={{ fontFamily: "Georgia, serif" }}
        >
          H·O·P·E
        </Link>

        {/* Desktop */}
        <ul className="hidden md:flex gap-6 items-center">
          {links.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <li key={href}>
                <Link
                  href={href}
                  className="text-sm transition-opacity"
                  style={{
                    fontFamily: "system-ui, sans-serif",
                    color: active ? "var(--terracotta-light)" : "rgba(255,255,255,0.8)",
                    fontWeight: active ? "600" : "400",
                  }}
                >
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Mobile toggle */}
        <button
          className="md:hidden text-white opacity-80 hover:opacity-100"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? "✕" : "☰"}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <ul className="md:hidden mt-4 flex flex-col gap-3 max-w-4xl mx-auto">
          {links.map(({ href, label }) => (
            <li key={href}>
              <Link
                href={href}
                onClick={() => setOpen(false)}
                className="block text-sm py-1"
                style={{
                  fontFamily: "system-ui, sans-serif",
                  color: pathname === href ? "var(--terracotta-light)" : "rgba(255,255,255,0.75)",
                }}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}
