import "server-only";

import { createServerClient } from "@supabase/ssr";
import { STSClient, AssumeRoleCommand } from "@aws-sdk/client-sts";
import { kickOffBlueprintGeneration } from "./blueprint";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

function adminClient() {
  return createServerClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE ?? SUPABASE_KEY,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    }
  );
}

type ProjectForAutoVerify = {
  id: string;
  blueprint_status: string;
  aws_role_verified_at: string | null;
  ecr_aws_account_id: string | null;
  ecr_webhook_token: string | null;
  git_repo_full_name: string | null;
  git_webhook_id: number | null;
};

/**
 * Active verification on every project page load.
 *
 * For AWS-connected projects: tries to assume the read-only role we expect
 * the CFN stack to have created. If AssumeRole succeeds, we know the stack
 * is live AND the trust policy is correct — so we mark the project as
 * verified and kick off blueprint generation, which runs full discovery.
 *
 * For GitHub: webhook installation is already verified at connect time
 * (we have git_webhook_id). No active check needed.
 *
 * Returns whether we kicked off generation, so the caller can re-fetch
 * project state if needed.
 */
export async function maybeAutoVerify(
  project: ProjectForAutoVerify
): Promise<{ ran: boolean; reason?: string }> {
  // Already produced a blueprint: nothing to do.
  if (project.blueprint_status === "ready") {
    return { ran: false, reason: "blueprint-ready" };
  }
  // Already generating: don't restart mid-flight.
  if (project.blueprint_status === "generating") {
    return { ran: false, reason: "already-generating" };
  }

  // GitHub-only: webhook is verified at connect time. Generation kicks off
  // when the first push event fires our webhook handler. Nothing to do here.
  if (
    !project.ecr_aws_account_id &&
    project.git_repo_full_name &&
    project.git_webhook_id
  ) {
    return { ran: false, reason: "github-webhook-mode" };
  }

  // AWS path: must have account ID + token to even attempt verification.
  if (!project.ecr_aws_account_id || !project.ecr_webhook_token) {
    return { ran: false, reason: "missing-aws-fields" };
  }

  const result = await tryAssumeRole({
    accountId: project.ecr_aws_account_id,
    externalId: project.ecr_webhook_token,
  });

  // Always record the attempt timestamp — distinguishes "we haven't
  // checked in days" from "we checked recently and it failed".
  const supabase = adminClient();
  if (!result.ok) {
    await supabase
      .from("projects")
      .update({ aws_role_last_checked_at: new Date().toISOString() })
      .eq("id", project.id);
    // Role doesn't exist yet (CFN stack not created/updated) or trust
    // policy doesn't match. Either way, we don't have ground to stand on.
    return { ran: false, reason: result.reason };
  }

  // Role is live. Mark verified and kick off blueprint generation. The
  // generator's collectSourceContext will run full discovery, which is
  // what separately stamps cfn_template_version (only when there are no
  // permission errors) and overwrites aws_region with what was actually
  // observed.
  const now = new Date().toISOString();
  await supabase
    .from("projects")
    .update({
      aws_role_verified_at: now,
      aws_role_last_checked_at: now,
    })
    .eq("id", project.id);

  await kickOffBlueprintGeneration(project.id);
  return { ran: true };
}

export async function tryAssumeRole(args: {
  accountId: string;
  externalId: string;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const accessKeyId = process.env.STACKLENSE_AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.STACKLENSE_AWS_SECRET_ACCESS_KEY;
  const region = process.env.STACKLENSE_AWS_REGION || "us-east-1";
  if (!accessKeyId || !secretAccessKey) {
    return { ok: false, reason: "no-stacklense-aws-creds" };
  }

  const roleArn = `arn:aws:iam::${args.accountId}:role/StackLense-ReadOnly-${args.accountId}`;
  const sts = new STSClient({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });

  try {
    const r = await sts.send(
      new AssumeRoleCommand({
        RoleArn: roleArn,
        RoleSessionName: `stacklense-verify-${Date.now()}`,
        ExternalId: args.externalId,
        DurationSeconds: 900,
      })
    );
    if (!r.Credentials) return { ok: false, reason: "no-credentials" };
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, reason: msg };
  }
}
