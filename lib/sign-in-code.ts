// The emailed sign-in code (TODO §14). Shared by the form and the verify route,
// so the two cannot disagree about what a code looks like. Deliberately free of
// Supabase imports so the client bundle can use it.

/**
 * Must match Supabase → Authentication → Email → "Email OTP Length". This
 * project uses 8. If the dashboard setting changes, change this and nothing
 * else.
 */
export const OTP_LENGTH = 8;

const CODE_PATTERN = new RegExp(`^\\d{${OTP_LENGTH}}$`);

/** Strips whitespace: people copy a code the way an email lays it out. */
export function normalizeCode(input: unknown): string {
  return typeof input === "string" ? input.replace(/\s+/g, "") : "";
}

/** True for exactly OTP_LENGTH digits, after normalizing. */
export function isValidCode(input: unknown): boolean {
  return CODE_PATTERN.test(normalizeCode(input));
}
