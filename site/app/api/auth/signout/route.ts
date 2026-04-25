import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

/**
 * Sign-out endpoint. POST-only to prevent CSRF via simple links.
 * Clears the Supabase session cookie and bounces to /login.
 */
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  await supabase.auth.signOut();

  const { origin } = new URL(request.url);
  // 303 forces a GET on the redirect target.
  return NextResponse.redirect(`${origin}/login`, { status: 303 });
}
