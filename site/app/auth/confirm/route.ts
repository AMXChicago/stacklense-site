import { type EmailOtpType } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

/**
 * Magic-link confirmation handler. Handles both Supabase email-link flows:
 *
 *   1. token_hash flow — email template uses {{ .TokenHash }} and links
 *      directly here with `?token_hash=...&type=...`. We call verifyOtp
 *      to consume the token and create the session.
 *
 *   2. Default Supabase template flow — email links to the Supabase-hosted
 *      /auth/v1/verify endpoint, which exchanges the token, sets our
 *      session cookies, then redirects to our redirectTo (which is this
 *      route). In that case we have no token_hash query param, but the
 *      session is already in cookies, so we just bounce to `next`.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/dashboard";

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // Path A — token_hash query flow
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    // fall through to Path B in case Supabase already verified
  }

  // Path B — Supabase already handled verification on its side; check session
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent(
      "This sign-in link is invalid or has expired. Request a new one."
    )}`
  );
}
