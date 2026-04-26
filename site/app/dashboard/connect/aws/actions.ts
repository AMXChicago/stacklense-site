"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { createClient } from "@/utils/supabase/server";

function generateWebhookToken() {
  // 48 chars of url-safe random — fits the CFN regex 32-128.
  return randomBytes(36).toString("base64url");
}

/**
 * Server action — create a new AWS-ECR-connected project. Generates a
 * unique webhook token, persists the project, and redirects to the
 * project detail page where the user gets the CloudFormation Quick Create
 * button (with the token prefilled).
 *
 * No IAM role, no STS, no cross-account access — the user installs an
 * EventBridge rule in their account that POSTs to our webhook with the
 * token in a header. We validate, regenerate the blueprint, done.
 */
export async function createAwsProject(formData: FormData) {
  const projectName = String(formData.get("project_name") ?? "").trim();
  const description =
    String(formData.get("description") ?? "").trim() || null;
  const ecrAccountId =
    String(formData.get("ecr_account_id") ?? "").trim() || null;
  const ecrRepoName =
    String(formData.get("ecr_repo_name") ?? "").trim() || null;

  if (!projectName) {
    redirect(
      `/dashboard/connect/aws?error=${encodeURIComponent(
        "Please give your project a name."
      )}`
    );
  }
  if (ecrAccountId && !/^[0-9]{12}$/.test(ecrAccountId)) {
    redirect(
      `/dashboard/connect/aws?error=${encodeURIComponent(
        "AWS account ID must be 12 digits if provided."
      )}`
    );
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const token = generateWebhookToken();

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      name: projectName,
      description,
      ecr_aws_account_id: ecrAccountId,
      ecr_repo_name: ecrRepoName,
      ecr_webhook_token: token,
      blueprint_status: "pending",
    })
    .select("id")
    .single();

  if (error || !project) {
    redirect(
      `/dashboard/connect/aws?error=${encodeURIComponent(
        error?.message ?? "Failed to create project."
      )}`
    );
  }

  redirect(`/dashboard/${project.id}`);
}
