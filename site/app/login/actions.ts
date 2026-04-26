"use server";

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { createClient } from "@/utils/supabase/server";

/**
 * Resolve the request's origin from forwarded headers — works on both
 * Vercel preview URLs and the apex domain.
 */
async function getOrigin() {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host") ?? "stacklense.com";
  return `${proto}://${host}`;
}

export async function signInWithMagicLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!email || !email.includes("@")) {
    redirect(
      `/login?error=${encodeURIComponent("Please enter a valid email address.")}`
    );
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const origin = await getOrigin();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/confirm`,
    },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/login?sent=${encodeURIComponent(email)}`);
}

export async function signInWithGitHub() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const origin = await getOrigin();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  if (data.url) {
    redirect(data.url);
  }
}
