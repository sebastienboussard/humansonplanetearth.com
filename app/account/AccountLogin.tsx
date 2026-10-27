"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase-browser";
import { OTP_LENGTH, isValidCode, normalizeCode } from "@/lib/sign-in-code";

type Status = "idle" | "sending" | "sent" | "error";

const sans = { fontFamily: "system-ui, sans-serif" } as const;

export default function AccountLogin() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [codeError, setCodeError] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const linkError = searchParams.get("error") === "link";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (honeypot) return; // bot
    if (!email.trim()) return;

    setStatus("sending");
    setErrorMsg("");

    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    });

    if (error) {
      // Supabase has two different 429s here. One is a per-address cooldown of
      // about a minute. The other is the project-wide cap on emails per hour,
      // where "wait a minute" would be wrong.
      setErrorMsg(
        error.code === "over_email_send_rate_limit"
          ? "We've sent a lot of sign-in emails in the last hour. Please try again later."
          : error.status === 429
            ? "Please wait a minute before requesting another link."
            : "Could not send the sign-in link. Please try again."
      );
      setStatus("error");
    } else {
      setStatus("sent");
    }
  }

  // The code works on any device, unlike the link, which only works in this
  // browser (app/api/auth/verify-code/route.ts says why). So this panel is
  // the way in for someone who opened the email on their phone.
  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidCode(code) || verifying) return;

    setVerifying(true);
    setCodeError("");
    try {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), token: normalizeCode(code) }),
      });
      if (res.ok) {
        // The session cookies are set; re-render the page server-side, which
        // now finds a user and shows the dashboard.
        router.refresh();
        return;
      }
      const body = await res.json().catch(() => ({}));
      setCodeError(body.error ?? "Could not check that code. Please try again.");
    } catch {
      setCodeError("Could not check that code. Please try again.");
    }
    setVerifying(false);
  }

  function startOver() {
    setStatus("idle");
    setCode("");
    setCodeError("");
  }

  if (status === "sent") {
    return (
      <div
        className="py-10 px-6 rounded-sm"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
      >
        <p className="text-lg mb-2 text-center" style={{ color: "var(--forest)" }}>
          Check your inbox.
        </p>
        <p className="text-sm italic text-center mb-8" style={{ color: "var(--muted)" }}>
          We sent a sign-in link and a code to {email.trim()}. Both expire in an hour.
        </p>

        <form onSubmit={handleVerify} className="max-w-xs mx-auto space-y-3">
          <label htmlFor="code" className="block text-sm" style={{ ...sans, color: "var(--ink)" }}>
            Or type the code from the email here. It works even if you opened the email on another device.
          </label>
          <input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={OTP_LENGTH + 2}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={"0".repeat(OTP_LENGTH)}
            className="w-full px-4 py-3 rounded-sm text-center"
            style={{
              ...sans,
              backgroundColor: "var(--parchment)",
              border: "1px solid var(--border)",
              color: "var(--ink)",
              fontSize: "1.25rem",
              letterSpacing: "0.3em",
              outline: "none",
            }}
          />
          {codeError && (
            <p className="text-sm" style={{ ...sans, color: "var(--terracotta)" }}>
              {codeError}
            </p>
          )}
          <button
            type="submit"
            disabled={!isValidCode(code) || verifying}
            className="w-full py-3 text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ ...sans, backgroundColor: "var(--terracotta)", letterSpacing: "0.05em" }}
          >
            {verifying ? "Checking…" : "Sign In With Code"}
          </button>
        </form>

        <p className="text-xs text-center mt-6" style={{ ...sans, color: "var(--muted)" }}>
          Wrong address?{" "}
          <button type="button" onClick={startOver} className="underline">
            Use a different email
          </button>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {linkError && (
        <p className="text-sm" style={{ color: "var(--terracotta)", fontFamily: "system-ui, sans-serif" }}>
          That sign-in link is invalid or expired. Request a new one below.
        </p>
      )}

      <div>
        <label
          htmlFor="email"
          className="block text-sm mb-2"
          style={{ fontFamily: "system-ui, sans-serif", color: "var(--ink)" }}
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full px-4 py-3 rounded-sm"
          style={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
            color: "var(--ink)",
            fontFamily: "system-ui, sans-serif",
            fontSize: "0.875rem",
            outline: "none",
          }}
        />
        <p className="text-xs mt-2" style={{ color: "var(--muted)", fontFamily: "system-ui, sans-serif" }}>
          No password. We email you a sign-in link and a code. Opened it on your phone?
          Type the code back here. Your email is never shown anywhere.
        </p>
      </div>

      {/* Honeypot — hidden from real users */}
      <div style={{ display: "none" }} aria-hidden="true">
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      {errorMsg && (
        <p className="text-sm" style={{ color: "var(--terracotta)", fontFamily: "system-ui, sans-serif" }}>
          {errorMsg}
        </p>
      )}

      <button
        type="submit"
        disabled={!email.trim() || status === "sending"}
        className="w-full py-3 text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          backgroundColor: "var(--terracotta)",
          fontFamily: "system-ui, sans-serif",
          letterSpacing: "0.05em",
        }}
      >
        {status === "sending" ? "Sending…" : "Email Me a Sign-In Link"}
      </button>
    </form>
  );
}
