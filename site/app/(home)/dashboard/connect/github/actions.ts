"use server";

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { randomBytes } from "crypto";
import { createClient } from "@/utils/supabase/server";
import { kickOffBlueprintGeneration } from "@/lib/blueprint";

async function getOrigin() {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host") ?? "stacklense.com";
  return `${proto}://${host}`;
}

/**
 * Re-authenticate with GitHub, requesting the `repo` scope so we can list the
 * user's repositories AND install push webhooks. Lands them back at
 * /dashboard/connect/github with a fresh provider_token.
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
 * Connect a GitHub repo as a project source. Three things happen:
 *
 *   1. We persist a row in `projects` with the GitHub coordinates and a
 *      freshly generated webhook secret (used to HMAC-verify pushes).
 *   2. We install a push webhook on the repo via the GitHub REST API,
 *      using the user's OAuth provider_token (must have `repo` scope).
 *   3. We kick off the initial blueprint generation in the background.
 *
 * If webhook install fails, we still keep the project row so the user can
 * see they're connected and we can retry later.
 */
export async function connectFromGitHubRepo(formData: FormData) {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const repoIdRaw = String(formData.get("repo_id") ?? "").trim();
  const repoId = repoIdRaw ? Number(repoIdRaw) : null;
  const description =
    String(formData.get("description") ?? "").trim() || null;

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
  if (!user) redirect("/login");

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const providerToken = session?.provider_token ?? null;

  // Per-project HMAC secret for GitHub push webhook verification.
  const webhookSecret = randomBytes(32).toString("base64url");
  const origin = await getOrigin();
  const webhookUrl = `${origin}/api/webhooks/github`;

  let webhookId: number | null = null;
  let webhookError: string | null = null;

  if (providerToken) {
    try {
      const r = await fetch(
        `https://api.github.com/repos/${fullName}/hooks`,
        {
          method: "POST",
          headers: {
            Authorization: `token ${providerToken}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: "web",
            active: true,
            events: ["push"],
            config: {
              url: webhookUrl,
              content_type: "json",
              secret: webhookSecret,
              insecure_ssl: "0",
            },
          }),
        }
      );
      if (r.ok) {
        const hook = (await r.json()) as { id: number };
        webhookId = hook.id;
      } else {
        webhookError = `GitHub hook install failed (${r.status})`;
      }
    } catch (e) {
      webhookError = e instanceof Error ? e.message : "hook install failed";
    }
  } else {
    webhookError = "no GitHub provider token in session";
  }

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      name: fullName,
      description,
      git_host: "github",
      git_repo_full_name: fullName,
      git_repo_id: repoId,
      git_webhook_secret: webhookSecret,
      git_webhook_id: webhookId,
      blueprint_status: "pending",
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

  if (webhookError) {
    console.warn(
      `[connect/github] project ${project.id} webhook not installed:`,
      webhookError
    );
  }

  // Kick off the initial blueprint generation in the background. The user
  // sees "generating" status on the project detail page until it lands.
  kickOffBlueprintGeneration(project.id).catch((e) => {
    console.error("blueprint kickoff failed:", e);
  });

  redirect(`/dashboard/${project.id}`);
}
