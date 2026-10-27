// Runs once per server instance, before it serves a request. Not during
// `next build`. An error thrown here fails every request on the instance —
// which is what lib/env.ts wants. Node runtime only: proxy.ts runs on the edge
// and reads only the two public Supabase vars, which are inlined at build.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertEnv } = await import("./lib/env");
    assertEnv();
  }
}
