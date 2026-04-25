"use server";

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { createClient } from "@/utils/supabase/server";

async function getOrigin() {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host") ?? "stacklense.com";
  return `${proto}://${host}`;
}

/**
 * Re-authenticate with GitHub, requesting the `repo` scope so we can list the
 * user's repositories. Lands them back at /dashboard/connect/github with a
 * fresh provider_token.
 */
export async function requestGitHubRepoScope() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const origin = await getOrigin();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      scopes: "repo",
      redirectTo: `${origin}/auth/callback?next=/dashboard/connect/github`,
    },
  });

  if (error) {
    redirect(
      `/dashboard/connect/github?error=${encodeURIComponent(error.message)}`
    );
  }
  if (data.url) {
    redirect(data.url);
  }
}

/**
 * Insert a project from the user's selected GitHub repo.
 */
export async function connectFromGitHubRepo(formData: FormData) {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;

  if (!fullName.includes("/")) {
    redirect(
      `/dashboard/connect/github?error=${encodeURIComponent(
        "Invalid repo selection."
      )}`
    );
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      name: fullName,
      description,
      // ecr_repo holds the GitHub full_name for now; a dedicated
      // `github_repo` column will land with the multi-tenant Lambda work.
      ecr_repo: `github:${fullName}`,
    })
    .select("id")
    .single();

  if (error || !project) {
    redirect(
      `/dashboard/connect/github?error=${encodeURIComponent(
        error?.message ?? "Failed to create project."
      )}`
    );
  }

  redirect(`/dashboard/${project.id}`);
}
