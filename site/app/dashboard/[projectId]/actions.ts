"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

/**
 * Update name + description on a project. RLS ensures the user can only
 * update projects they own (auth.uid() = user_id).
 */
export async function updateProject(formData: FormData) {
  const projectId = String(formData.get("project_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description =
    String(formData.get("description") ?? "").trim() || null;

  if (!projectId) {
    redirect("/dashboard");
  }
  if (!name) {
    redirect(
      `/dashboard/${projectId}?error=${encodeURIComponent(
        "Project name cannot be empty."
      )}`
    );
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { error } = await supabase
    .from("projects")
    .update({ name, description })
    .eq("id", projectId);

  if (error) {
    redirect(
      `/dashboard/${projectId}?error=${encodeURIComponent(error.message)}`
    );
  }

  revalidatePath(`/dashboard/${projectId}`);
  revalidatePath("/dashboard");
  redirect(`/dashboard/${projectId}?saved=1`);
}

/**
 * Hard-delete a project. Cascades through to deploys via FK.
 *
 * For GitHub-connected projects, attempts a best-effort cleanup of the
 * push webhook on github.com using the user's stored OAuth token. If that
 * fails (token expired, etc.), the project is still deleted on our side —
 * the GitHub webhook just becomes orphaned and the user can remove it
 * manually in their repo settings.
 *
 * For AWS-ECR-connected projects, the EventBridge rule in the customer's
 * AWS account remains. Deleting it requires CloudFormation stack delete,
 * which the customer must do themselves. Future polish: surface this in
 * the delete confirmation copy.
 */
export async function deleteProject(formData: FormData) {
  const projectId = String(formData.get("project_id") ?? "");
  if (!projectId) redirect("/dashboard");

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // Best-effort: try to remove the GitHub webhook before deleting our row.
  // Look up project + session for the provider token.
  const [projRes, sessionRes] = await Promise.all([
    supabase
      .from("projects")
      .select("git_repo_full_name, git_webhook_id")
      .eq("id", projectId)
      .single(),
    supabase.auth.getSession(),
  ]);

  const project = projRes.data;
  const providerToken = sessionRes.data.session?.provider_token ?? null;

  if (
    project?.git_repo_full_name &&
    project.git_webhook_id &&
    providerToken
  ) {
    try {
      await fetch(
        `https://api.github.com/repos/${project.git_repo_full_name}/hooks/${project.git_webhook_id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `token ${providerToken}`,
            Accept: "application/vnd.github+json",
          },
        }
      );
    } catch {
      // Ignore — orphaned webhook is acceptable
    }
  }

  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  if (error) {
    redirect(
      `/dashboard/${projectId}?error=${encodeURIComponent(error.message)}`
    );
  }

  revalidatePath("/dashboard");
  redirect("/dashboard?deleted=1");
}
