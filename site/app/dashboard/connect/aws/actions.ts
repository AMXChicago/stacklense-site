"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

/**
 * Server action — finalize an AWS connection. Called from the
 * /dashboard/connect/aws form after the user has created the
 * CloudFormation stack and pasted the role ARN back.
 *
 * We don't yet do live IAM verification (that requires assuming the role
 * via STS, which needs the StackLense backend with sts:AssumeRole permission).
 * For 5b MVP we just persist the user's input and trust them; the connector
 * verification step happens out-of-band when the EventBridge rule fires.
 */
export async function connectAwsProject(formData: FormData) {
  const accountId = String(formData.get("aws_account_id") ?? "").trim();
  const roleArn = String(formData.get("role_arn") ?? "").trim();
  const externalId = String(formData.get("external_id") ?? "").trim();
  const projectName = String(formData.get("project_name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;

  // Cheap input validation — RLS will catch anything weirder.
  if (!/^[0-9]{12}$/.test(accountId)) {
    redirect(
      `/dashboard/connect/aws?error=${encodeURIComponent(
        "AWS account ID must be 12 digits."
      )}`
    );
  }
  if (!/^arn:aws:iam::[0-9]{12}:role\/.+$/.test(roleArn)) {
    redirect(
      `/dashboard/connect/aws?error=${encodeURIComponent(
        "That doesn't look like a valid IAM role ARN."
      )}`
    );
  }
  if (!projectName) {
    redirect(
      `/dashboard/connect/aws?error=${encodeURIComponent(
        "Please give your project a name."
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
      name: projectName,
      description,
      aws_account_id: accountId,
      // We stash role ARN + external ID inside a description-ish field for
      // 5b. A dedicated columns/table will come with multi-tenant Lambda
      // wiring (separate task).
      ecr_repo: roleArn,
      blueprint_s3_bucket: externalId,
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
