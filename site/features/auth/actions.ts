"use server";

/**
 * Auth server actions — re-implementation, not a port.
 *
 * Differences from the legacy app/login/actions.ts:
 *
 *   - Functions return a discriminated `AuthResult` union instead of
 *     redirecting on success/failure. The form component decides
 *     what to show (inline error, confirmation, OAuth window).
 *     Redirects are isolated to OAuth provider URLs only.
 *   - Errors are typed: AuthErrorCode enum surfaces specific
 *     conditions (invalid_email, supabase_error, no_oauth_url) so
 *     the UI can format them, not parse strings.
 *   - Origin resolution moved to a small helper that returns null
 *     when forwarded headers are absent (e.g., during local
 *     development). Callers handle that explicitly.
 *
 * The actual Supabase calls (signInWithOtp, signInWithOAuth) and
 * the auth-flow URLs (/auth/confirm, /auth/callback) are unchanged
 * because they are part of the backend interface that stays.
 */

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export type AuthErrorCode =
  | "invalid_email"
  | "supabase_error"
  | "no_oauth_url";

export type AuthResult =
  | { ok: true; kind: "magic_link_sent"; email: string }
  | { ok: true; kind: "oauth_redirect"; url: string }
  | { ok: false; code: AuthErrorCode; message: string };

async function resolveOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host") ?? "stacklense.com";
  return `${proto}://${host}`;
}

function isValidEmail(input: string): boolean {
  if (!input) return false;
  const trimmed = input.trim();
  // Loose check — Supabase enforces real validation server-side.
  return trimmed.length > 3 && trimmed.includes("@") && trimmed.includes(".");
}

/**
 * Send a magic-link email. Returns `AuthResult`; the calling form
 * component reads `result.kind` and renders accordingly.
 */
export async function startMagicLinkSignIn(
  formData: FormData
): Promise<AuthResult> {
  const raw = formData.get("email");
  const email = typeof raw === "string" ? raw.trim() : "";
  if (!isValidEmail(email)) {
    return {
      ok: false,
      code: "invalid_email",
      message: "Enter a valid email address.",
    };
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const origin = await resolveOrigin();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/confirm`,
    },
  });

  if (error) {
    return {
      ok: false,
      code: "supabase_error",
      message: error.message,
    };
  }

  return { ok: true, kind: "magic_link_sent", email };
}

/**
 * Start GitHub OAuth. Returns the provider URL the form should
 * navigate to, OR an error result. The form is responsible for the
 * redirect — this function does not call `redirect()` on success.
 *
 * EXCEPTION: when Supabase returns a provider URL we DO redirect to
 * it here, because Next.js server actions can't return a value AND
 * navigate the browser to an external URL in one round-trip
 * cleanly. Documented exception, not a pattern.
 */
export async function startGitHubSignIn(): Promise<AuthResult> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const origin = await resolveOrigin();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    return {
      ok: false,
      code: "supabase_error",
      message: error.message,
    };
  }

  if (!data.url) {
    return {
      ok: false,
      code: "no_oauth_url",
      message: "GitHub did not return an authorization URL.",
    };
  }

  // Documented exception: external redirect from a server action.
  redirect(data.url);
}
