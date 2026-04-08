"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push("/admin/review");
    } else {
      const data = await res.json();
      setError(data.error ?? "Incorrect password.");
      setLoading(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto px-6 py-32">
      <h1 className="text-2xl font-normal mb-8" style={{ color: "var(--forest)" }}>
        Admin
      </h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="password"
          required
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-3 text-sm rounded-sm"
          style={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
            fontFamily: "system-ui, sans-serif",
            color: "var(--ink)",
            outline: "none",
          }}
        />
        {error && (
          <p className="text-sm" style={{ color: "var(--terracotta)", fontFamily: "system-ui, sans-serif" }}>
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 text-sm text-white disabled:opacity-50"
          style={{ backgroundColor: "var(--forest)", fontFamily: "system-ui, sans-serif" }}
        >
          {loading ? "Logging in…" : "Log in"}
        </button>
      </form>
    </div>
  );
}
