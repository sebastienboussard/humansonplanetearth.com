import { describe, expect, it } from "vitest";
import { jsonRequest } from "../helpers/request";
import { adminSessionToken } from "../helpers/admin";

import { POST as login } from "@/app/api/admin/login/route";
import { GET as logout } from "@/app/api/admin/logout/route";

const LOGIN_URL = "http://localhost:3000/api/admin/login";

describe("POST /api/admin/login", () => {
  it("rejects a wrong password without setting a cookie", async () => {
    const res = await login(jsonRequest(LOGIN_URL, { password: "wrong" }));

    expect(res.status).toBe(401);
    expect(res.cookies.get("admin_session")).toBeUndefined();
  });

  it("rejects a missing password", async () => {
    const res = await login(jsonRequest(LOGIN_URL, {}));
    expect(res.status).toBe(401);
  });

  it("rejects an empty-string password even if ADMIN_PASSWORD were empty", async () => {
    const res = await login(jsonRequest(LOGIN_URL, { password: "" }));
    expect(res.status).toBe(401);
  });

  it("sets a httpOnly HMAC session cookie on success", async () => {
    const res = await login(jsonRequest(LOGIN_URL, { password: process.env.ADMIN_PASSWORD }));

    expect(res.status).toBe(200);
    const cookie = res.cookies.get("admin_session");
    expect(cookie?.value).toBe(adminSessionToken());
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("lax");
  });
});

describe("GET /api/admin/logout", () => {
  it("clears the session cookie and redirects to /admin", async () => {
    const res = await logout();

    expect([302, 303, 307, 308]).toContain(res.status);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/admin");
    const cookie = res.cookies.get("admin_session");
    expect(cookie?.value).toBe("");
    expect(cookie?.maxAge).toBe(0);
  });
});
