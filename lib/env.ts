/**
 * Startup check for environment variables. Run once per server
 * instance from `instrumentation.ts`, so a missing secret stops the server
 * instead of surfacing at first use — or, worse, not surfacing at all.
 *
 * **Fails closed.** `register()` rethrowing makes every request on that
 * instance fail, which is the point: three of these vars are the security
 * boundary for something (admin sessions, the cron endpoint, unsubscribe
 * links), and each of those also refuses at its point of use when its var is
 * missing. This check is the loud half; the use sites are the half that holds
 * even if this one never runs.
 *
 * Hand-rolled rather than zod: eleven variables do not justify a dependency,
 * and the rules are only "present" and "a URL".
 */

type Rule = {
  name: string;
  required: boolean;
  url?: boolean;
};

const RULES: Rule[] = [
  { name: "NEXT_PUBLIC_SUPABASE_URL", required: true, url: true },
  { name: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY", required: true },
  { name: "SUPABASE_SECRET_KEY", required: true },
  { name: "ADMIN_PASSWORD", required: true },
  { name: "UNSUBSCRIBE_SECRET", required: true },
  { name: "CRON_SECRET", required: true },
  { name: "RESEND_API_KEY", required: true },
  // Optional: each has a default or an "unset means off" meaning at its use
  // site. Checked only for shape when present.
  { name: "NEXT_PUBLIC_SITE_URL", required: false, url: true },
  { name: "NOTIFY_FROM_EMAIL", required: false },
  { name: "ADMIN_NOTIFY_EMAIL", required: false },
];

function isUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

/** Every problem found, one line each. Empty means the environment is good. */
export function envProblems(env: Record<string, string | undefined> = process.env): string[] {
  const problems: string[] = [];
  for (const rule of RULES) {
    // A var set to whitespace is as missing as an absent one — and is what a
    // stray paste into the Vercel dashboard produces.
    const value = env[rule.name]?.trim();
    if (!value) {
      if (rule.required) problems.push(`${rule.name} is missing`);
      continue;
    }
    if (rule.url && !isUrl(value)) problems.push(`${rule.name} is not an http(s) URL`);
  }
  return problems;
}

/** Throws one error listing every problem, so one deploy shows them all. */
export function assertEnv(env: Record<string, string | undefined> = process.env): void {
  const problems = envProblems(env);
  if (problems.length > 0) {
    throw new Error(`Environment is misconfigured:\n  - ${problems.join("\n  - ")}`);
  }
}
