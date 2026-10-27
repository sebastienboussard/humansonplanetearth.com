import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createMockSupabase, type MockSupabase } from "../helpers/supabase-mock";
import { getRequest, jsonRequest } from "../helpers/request";
import { adminCookies } from "../helpers/admin";

const holder = vi.hoisted(() => ({ current: null as unknown as MockSupabase | null }));
vi.mock("@/lib/supabase", async () =>
  (await import("../helpers/supabase-mock")).supabaseModuleMock(holder)
);

import { DELETE, GET, PATCH } from "@/app/api/admin/rooms/route";

const URL = "http://localhost:3000/api/admin/rooms";
const del = (body: unknown, cookies = adminCookies()) =>
  new NextRequest(URL, {
    method: "DELETE",
    headers: { cookie: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ") },
    body: JSON.stringify(body),
  });

afterEach(() => {
  holder.current = null;
});

describe("admin rooms", () => {
  it("refuses every method without an admin session", async () => {
    holder.current = createMockSupabase();
    expect((await GET(getRequest(URL))).status).toBe(401);
    expect((await PATCH(jsonRequest(URL, { pageId: "p", status: "approved" }, { method: "PATCH" }))).status).toBe(401);
    expect((await DELETE(del({ roomId: "r" }, {}))).status).toBe(401);
    expect(holder.current.query("room_pages")).toBeUndefined();
  });

  it("lists pending pages and live rooms, touching no author table", async () => {
    holder.current = createMockSupabase({
      tables: { room_pages: { data: [{ id: "p1" }] }, rooms: { data: [{ id: "r1" }] } },
    });
    const res = await GET(getRequest(URL, { cookies: adminCookies() }));
    expect(await res.json()).toEqual({ pendingPages: [{ id: "p1" }], liveRooms: [{ id: "r1" }] });
    expect(holder.current.query("room_pages")!.eq).toHaveBeenCalledWith("status", "pending");
    expect(holder.current.query("room_pages")!.select.mock.calls[0][0]).not.toMatch(/author/);
    expect(holder.current.query("room_page_authors")).toBeUndefined();
  });

  it("approves a pending page, and only a pending one", async () => {
    holder.current = createMockSupabase({ tables: { room_pages: { data: [{ id: "p1" }] } } });
    const res = await PATCH(jsonRequest(URL, { pageId: "p1", status: "approved" }, { method: "PATCH", cookies: adminCookies() }));
    expect(res.status).toBe(200);
    const q = holder.current.query("room_pages")!;
    expect(q.update).toHaveBeenCalledWith({ status: "approved" });
    expect(q.eq).toHaveBeenCalledWith("status", "pending");
  });

  it("refuses any status but approved or rejected", async () => {
    holder.current = createMockSupabase();
    const res = await PATCH(jsonRequest(URL, { pageId: "p1", status: "pending" }, { method: "PATCH", cookies: adminCookies() }));
    expect(res.status).toBe(400);
  });

  it("returns 404 for a page already decided", async () => {
    holder.current = createMockSupabase({ tables: { room_pages: { data: [] } } });
    const res = await PATCH(jsonRequest(URL, { pageId: "p1", status: "rejected" }, { method: "PATCH", cookies: adminCookies() }));
    expect(res.status).toBe(404);
  });

  it("removes a live room by marking it removed, not deleting it", async () => {
    holder.current = createMockSupabase({ tables: { rooms: { data: [{ id: "r1" }] } } });
    expect((await DELETE(del({ roomId: "r1" }))).status).toBe(200);
    const q = holder.current.query("rooms")!;
    expect(q.update).toHaveBeenCalledWith({ status: "removed" });
    expect(q.delete).not.toHaveBeenCalled();
  });
});
