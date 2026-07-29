import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import { createMockSupabase, type MockSupabase } from "../helpers/supabase-mock";
import { type UserHolder } from "../helpers/auth-mock";

const holder = vi.hoisted(() => ({ current: null as unknown as MockSupabase | null }));
vi.mock("@/lib/supabase", async () =>
  (await import("../helpers/supabase-mock")).supabaseModuleMock(holder)
);

const userHolder = vi.hoisted(() => ({ current: null }) as UserHolder);
vi.mock("@/lib/supabase-server", async () =>
  (await import("../helpers/auth-mock")).supabaseServerModuleMock(userHolder)
);

import { POST } from "@/app/api/account/delete/route";

const user = { id: "user-1", email: "human@example.com" };

// The shared mock client has no auth API — bolt on the admin surface the route uses.
function withAuthAdmin(client: MockSupabase, deleteError: { message: string } | null = null) {
  const deleteUser = vi.fn(async () => ({ data: null, error: deleteError }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (client as any).auth = { admin: { deleteUser } };
  return deleteUser;
}

afterEach(() => {
  holder.current = null;
  userHolder.current = null;
});

describe("POST /api/account/delete", () => {
  it("returns 401 when not signed in", async () => {
    holder.current = createMockSupabase();
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it("deletes the auth user by session uid (cascades wipe the profile)", async () => {
    userHolder.current = user;
    holder.current = createMockSupabase();
    const deleteUser: Mock = withAuthAdmin(holder.current);

    const res = await POST();

    expect(res.status).toBe(200);
    expect(deleteUser).toHaveBeenCalledWith("user-1");
  });

  it("returns 500 when deletion fails", async () => {
    userHolder.current = user;
    holder.current = createMockSupabase();
    withAuthAdmin(holder.current, { message: "boom" });

    const res = await POST();
    expect(res.status).toBe(500);
  });
});
