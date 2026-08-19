import { afterEach, describe, expect, it, vi } from "vitest";
import { getRequest } from "../helpers/request";

// The route only ever touches supabase.auth, so mock the module directly
// rather than reaching for the shared server-client helper.
const auth = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(async () => ({ error: null as { message: string } | null })),
  verifyOtp: vi.fn(async () => ({ error: null as { message: string } | null })),
}));

vi.mock("@/lib/supabase-server", () => ({
  createServerSupabase: async () => ({ auth }),
}));

import { GET } from "@/app/auth/confirm/route";

const URL_BASE = "https://humansonplanetearth.com/auth/confirm";

function location(res: Response) {
  return new URL(res.headers.get("location")!).pathname + new URL(res.headers.get("location")!).search;
}

afterEach(() => {
  auth.exchangeCodeForSession.mockClear();
  auth.exchangeCodeForSession.mockResolvedValue({ error: null });
  auth.verifyOtp.mockClear();
  auth.verifyOtp.mockResolvedValue({ error: null });
});

describe("GET /auth/confirm", () => {
  // The default Supabase email template produces this shape. Handling only
  // token_hash broke every sign-in on production.
  it("exchanges a PKCE code and lands the reader on /account", async () => {
    const res = await GET(getRequest(`${URL_BASE}?code=pkce-code-123`));

    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("pkce-code-123");
    expect(location(res)).toBe("/account");
  });

  it("verifies a token_hash link, for templates overridden to that form", async () => {
    const res = await GET(getRequest(`${URL_BASE}?token_hash=hash-abc&type=magiclink`));

    expect(auth.verifyOtp).toHaveBeenCalledWith({ type: "magiclink", token_hash: "hash-abc" });
    expect(location(res)).toBe("/account");
  });

  it("defaults the OTP type to email when the link omits it", async () => {
    await GET(getRequest(`${URL_BASE}?token_hash=hash-abc`));

    expect(auth.verifyOtp).toHaveBeenCalledWith({ type: "email", token_hash: "hash-abc" });
  });

  it("prefers the code exchange when a link somehow carries both", async () => {
    await GET(getRequest(`${URL_BASE}?code=c1&token_hash=h1`));

    expect(auth.exchangeCodeForSession).toHaveBeenCalledOnce();
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });

  it("reports a link error when the code exchange fails", async () => {
    auth.exchangeCodeForSession.mockResolvedValueOnce({ error: { message: "expired" } });

    const res = await GET(getRequest(`${URL_BASE}?code=stale`));

    expect(location(res)).toBe("/account?error=link");
  });

  it("reports a link error when OTP verification fails", async () => {
    auth.verifyOtp.mockResolvedValueOnce({ error: { message: "already used" } });

    const res = await GET(getRequest(`${URL_BASE}?token_hash=used`));

    expect(location(res)).toBe("/account?error=link");
  });

  it("reports a link error when the link carries neither parameter", async () => {
    const res = await GET(getRequest(URL_BASE));

    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(auth.verifyOtp).not.toHaveBeenCalled();
    expect(location(res)).toBe("/account?error=link");
  });

  // Supabase appends its own error params when a link is expired or reused.
  it("passes a provider error through without attempting verification", async () => {
    const res = await GET(
      getRequest(`${URL_BASE}?error=access_denied&error_description=Email+link+is+invalid`)
    );

    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(location(res)).toBe("/account?error=link");
  });
});
