"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { createHmac, randomBytes } from "crypto";
import { createClient } from "@/utils/supabase/server";
import { kickOffBlueprintGeneration } from "@/lib/blueprint";

/**
 * Update name + description on a project. RLS ensures the user can only
 * update projects they own (auth.uid() = user_id).
 */
export async function updateProject(formData: FormData) {
  const projectId = String(formData.get("project_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description =
    String(formData.get("description") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

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
    .update({ name, description, notes })
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

/**
 * Manually re-trigger blueprint generation. Useful when the previous run
 * failed, when source content has changed in a way our webhooks don't see
 * (e.g. README edits between commits), or when the user just wants a fresh
 * pass.
 */
export async function regenerateBlueprint(formData: FormData) {
  const projectId = String(formData.get("project_id") ?? "");
  if (!projectId) redirect("/dashboard");

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // Verify the user owns the project before kicking off generation. RLS
  // already enforces this, but failing fast with a useful redirect is nicer.
  const { data: project, error } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .single();
  if (error || !project) redirect(`/dashboard/${projectId}?error=Not%20found`);

  await kickOffBlueprintGeneration(projectId);

  revalidatePath(`/dashboard/${projectId}`);
  redirect(`/dashboard/${projectId}?regenerating=1`);
}

/**
 * Send a synthetic update to our own webhook to verify end-to-end wiring
 * without the user needing to actually ship something. Source-aware:
 *
 *   - GitHub: build a fake `push` payload, HMAC-sign with the project's
 *     git_webhook_secret, POST to /api/webhooks/github with the standard
 *     GitHub headers (x-github-event: push, x-hub-signature-256: ...).
 *   - AWS ECR: build a fake EventBridge "ECR Image Action" event, POST to
 *     /api/webhooks/aws/[token] with the X-StackLense-Token header.
 *
 * If a project has both sources connected, we test GitHub first (it's the
 * more common everyday push trigger). The user can also flag in the form
 * which one they want to test via the `source` field.
 */
export async function sendTestEvent(formData: FormData) {
  const projectId = String(formData.get("project_id") ?? "");
  const requestedSource = String(formData.get("source") ?? "");
  if (!projectId) redirect("/dashboard");

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: project, error } = await supabase
    .from("projects")
    .select(
      "id, git_repo_full_name, git_repo_id, git_webhook_secret, ecr_webhook_token, ecr_repo_name, ecr_aws_account_id"
    )
    .eq("id", projectId)
    .single();
  if (error || !project)
    redirect(`/dashboard/${projectId}?error=Not%20found`);

  const hasGitHub = !!project.git_webhook_secret && !!project.git_repo_full_name;
  const hasEcr = !!project.ecr_webhook_token;

  // Pick which source to fire. Caller may force one via formData.source;
  // otherwise default to GitHub if available, else ECR.
  let source: "github" | "ecr" | null = null;
  if (requestedSource === "github" && hasGitHub) source = "github";
  else if (requestedSource === "ecr" && hasEcr) source = "ecr";
  else if (hasGitHub) source = "github";
  else if (hasEcr) source = "ecr";

  if (!source) {
    redirect(
      `/dashboard/${projectId}?error=${encodeURIComponent(
        "This project has no connected source to test. Connect GitHub or AWS ECR first."
      )}`
    );
  }

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host") ?? "stacklense.com";
  const origin = `${proto}://${host}`;

  let errorMsg: string | null = null;
  try {
    if (source === "ecr") {
      const url = `${origin}/api/webhooks/aws/${project.ecr_webhook_token}`;
      const payload = {
        version: "0",
        id: `stacklense-test-${randomBytes(8).toString("hex")}`,
        "detail-type": "ECR Image Action",
        source: "aws.ecr",
        account: project.ecr_aws_account_id ?? "000000000000",
        time: new Date().toISOString(),
        region: "us-east-1",
        resources: [],
        detail: {
          "action-type": "PUSH",
          result: "SUCCESS",
          "repository-name": project.ecr_repo_name ?? "stacklense-test",
          "image-tag": "stacklense-test-update",
          "image-digest": `sha256:${randomBytes(32).toString("hex")}`,
        },
      };
      const r = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-StackLense-Token": project.ecr_webhook_token!,
          "X-StackLense-Synthetic": "1",
        },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const text = await r.text();
        errorMsg = `Test update returned ${r.status}: ${text.slice(0, 200)}`;
      }
    } else {
      // GitHub push
      const url = `${origin}/api/webhooks/github`;
      const fakeSha = randomBytes(20).toString("hex");
      const payload = {
        ref: "refs/heads/main",
        repository: {
          full_name: project.git_repo_full_name,
          id: project.git_repo_id ?? 0,
        },
        head_commit: {
          id: fakeSha,
          message: "stacklense: test update",
          timestamp: new Date().toISOString(),
          author: {
            name: "StackLense",
            email: "noreply@stacklense.com",
          },
        },
      };
      const rawBody = JSON.stringify(payload);
      const sig =
        "sha256=" +
        createHmac("sha256", project.git_webhook_secret!)
          .update(rawBody)
          .digest("hex");
      const r = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-GitHub-Event": "push",
          "X-Hub-Signature-256": sig,
          "X-StackLense-Synthetic": "1",
        },
        body: rawBody,
      });
      if (!r.ok) {
        const text = await r.text();
        errorMsg = `Test update returned ${r.status}: ${text.slice(0, 200)}`;
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errorMsg = `Test update failed: ${msg}`;
  }

  if (errorMsg) {
    redirect(
      `/dashboard/${projectId}?error=${encodeURIComponent(errorMsg)}`
    );
  }

  revalidatePath(`/dashboard/${projectId}`);
  redirect(`/dashboard/${projectId}?test_sent=1`);
}

