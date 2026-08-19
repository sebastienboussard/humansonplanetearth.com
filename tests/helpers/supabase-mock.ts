import { vi, type Mock } from "vitest";

export type QueryResult = {
  data?: unknown;
  error?: { message: string } | null;
};

const CHAIN_METHODS = [
  "select",
  "insert",
  "update",
  "delete",
  "upsert",
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "in",
  "is",
  "like",
  "ilike",
  "order",
  "limit",
  "range",
  "single",
  "maybeSingle",
] as const;

type ChainMethod = (typeof CHAIN_METHODS)[number];

export type RecordedQuery = { table: string } & Record<ChainMethod, Mock> & PromiseLike<{
    data: unknown;
    error: { message: string } | null;
  }>;

function makeQuery(table: string, result: Required<QueryResult>): RecordedQuery {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query: any = { table };
  for (const method of CHAIN_METHODS) {
    query[method] = vi.fn(() => query);
  }
  // Awaiting the chain (or any link of it) resolves to the queued result.
  query.then = (
    onFulfilled?: (value: { data: unknown; error: { message: string } | null }) => unknown,
    onRejected?: (reason: unknown) => unknown
  ) => Promise.resolve({ data: result.data, error: result.error }).then(onFulfilled, onRejected);
  return query as RecordedQuery;
}

export type StorageBucketMock = {
  upload: Mock;
  remove: Mock;
  getPublicUrl: Mock;
};

export type RpcResult = {
  data?: unknown;
  error?: { message: string } | null;
};

export type MockSupabaseOptions = {
  /**
   * Results keyed by RPC function name. Anything not listed resolves to
   * `{ data: null, error: null }`, which `rateLimit` treats as a store failure
   * and therefore allows — matching production's fail-open behaviour.
   */
  rpcs?: Record<string, RpcResult>;
  /**
   * Results keyed by table name. An array is consumed as a FIFO queue —
   * one entry per `.from(table)` call. A single object is reused as the
   * result for the first call (subsequent calls get { data: null, error: null }).
   */
  tables?: Record<string, QueryResult | QueryResult[]>;
  storage?: {
    uploadError?: { message: string } | null;
    removeError?: { message: string } | null;
  };
};

export function createMockSupabase(options: MockSupabaseOptions = {}) {
  const queues: Record<string, QueryResult[]> = {};
  for (const [table, results] of Object.entries(options.tables ?? {})) {
    queues[table] = Array.isArray(results) ? [...results] : [results];
  }

  const queries: RecordedQuery[] = [];
  const buckets: Record<string, StorageBucketMock> = {};
  const storageOpts = options.storage ?? {};

  const rpcResults = options.rpcs ?? {};
  const rpcCalls: { fn: string; args: unknown }[] = [];

  const client = {
    rpc: vi.fn(async (fn: string, args: unknown) => {
      rpcCalls.push({ fn, args });
      const queued = rpcResults[fn];
      return { data: queued?.data ?? null, error: queued?.error ?? null };
    }),
    from: vi.fn((table: string) => {
      const queued = queues[table]?.shift();
      const query = makeQuery(table, {
        data: queued?.data ?? null,
        error: queued?.error ?? null,
      });
      queries.push(query);
      return query;
    }),
    storage: {
      from: vi.fn((bucket: string) => {
        buckets[bucket] ??= {
          upload: vi.fn(async () => ({ data: null, error: storageOpts.uploadError ?? null })),
          remove: vi.fn(async () => ({ data: null, error: storageOpts.removeError ?? null })),
          getPublicUrl: vi.fn((path: string) => ({
            data: { publicUrl: `https://storage.test/${bucket}/${path}` },
          })),
        };
        return buckets[bucket];
      }),
    },
    /** All query chains created so far, in call order. */
    queries,
    /** Every rpc() call made, in order. */
    rpcCalls,
    /** The nth query made against a table (0-based). */
    query(table: string, nth = 0): RecordedQuery | undefined {
      return queries.filter((q) => q.table === table)[nth];
    },
    /** Storage bucket mock, if the code under test touched it. */
    bucket(name: string): StorageBucketMock | undefined {
      return buckets[name];
    },
  };

  return client;
}

export type MockSupabase = ReturnType<typeof createMockSupabase>;

export type SupabaseHolder = { current: MockSupabase | null };

/**
 * Module factory for `vi.mock("@/lib/supabase", ...)`. Both the public
 * `supabase` client and `getAdminClient()` delegate to `holder.current`,
 * so each test can install a fresh mock:
 *
 *   const holder = vi.hoisted(() => ({ current: null as any }));
 *   vi.mock("@/lib/supabase", async () =>
 *     (await import("../helpers/supabase-mock")).supabaseModuleMock(holder)
 *   );
 *   // in a test:
 *   holder.current = createMockSupabase({ tables: { words: { data: [...] } } });
 */
export function supabaseModuleMock(holder: SupabaseHolder) {
  const requireClient = (): MockSupabase => {
    if (!holder.current) {
      throw new Error(
        "No mock Supabase client installed — set holder.current = createMockSupabase(...) before calling the code under test."
      );
    }
    return holder.current;
  };

  return {
    supabase: new Proxy({} as Record<string | symbol, unknown>, {
      get: (_target, prop) => (requireClient() as unknown as Record<string | symbol, unknown>)[prop],
    }),
    getAdminClient: () => requireClient(),
  };
}
