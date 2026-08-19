import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase-server";

// Magic-link landing: verifies the emailed token and starts the session.
//
// Two link shapes reach here, and both must work:
//
//   ?code=...        Supabase's default email template sends the reader through
//                    its own /auth/v1/verify endpoint, which bounces them back
//                    here with a PKCE code. `createBrowserClient` from
//                    @supabase/ssr requests links this way, so this is the
//                    shape you get unless the template is overridden. The code
//                    is exchanged against a verifier cookie set when the link
//                    was requested — meaning the link only works in the same
//                    browser that asked for it.
//
//   ?token_hash=...  Produced when the email template is overridden to the
//                    {{ .TokenHash }} form. Carries no PKCE verifier, so it
//                    works across devices — open it on your phone, stay signed
//                    in on your phone.
//
// Handling only token_hash silently broke every sign-in: the default template
// never sends it, so verification was skipped and the reader was bounced to
// "That sign-in link is invalid or expired."
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = (searchParams.get("type") as EmailOtpType | null) ?? "email";

  // Supabase reports its own failures (expired, already used) on the redirect.
  const providerError = searchParams.get("error_description") ?? searchParams.get("error");

  if (providerError) {
    console.error("Magic-link provider error:", providerError);
  } else if (code || tokenHash) {
    const supabase = await createServerSupabase();
    const { error } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({ type, token_hash: tokenHash! });

    if (!error) {
      return NextResponse.redirect(new URL("/account", req.url));
    }
    console.error("Magic-link verification failed:", error.message);
  }

  return NextResponse.redirect(new URL("/account?error=link", req.url));
}
