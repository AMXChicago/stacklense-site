import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createHmac, randomBytes } from "crypto";

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
  auto_verify_at: string | null;
  git_repo_full_name: string | null;
  git_repo_id: number | null;
  git_webhook_secret: string | null;
  ecr_webhook_token: string | null;
  ecr_repo_name: string | null;
  ecr_aws_account_id: string | null;
};

const RETRY_WINDOW_MS = 3_600_000; // 1 hour
const FIRE_TIMEOUT_MS = 5_000;

/**
 * Fire a synthetic event automatically if a freshly-connected project hasn't
 * received anything yet. Replaces "user must click Send a test update" with
 * "page just works on first visit." Idempotent within an hour via the
 * auto_verify_at column.
 */
export async function maybeAutoVerify(
  project: ProjectForAutoVerify,
  deploysCount: number,
  origin: string
): Promise<{ ran: boolean; reason?: string }> {
  const hasGitHub =
    !!project.git_webhook_secret && !!project.git_repo_full_name;
  const hasEcr = !!project.ecr_webhook_token;

  if (!hasGitHub && !hasEcr) return { ran: false, reason: "no-source" };
  if (deploysCount > 0) return { ran: false, reason: "has-events" };
  if (project.blueprint_status !== "pending")
    return { ran: false, reason: `status=${project.blueprint_status}` };
  if (
    project.auto_verify_at &&
    Date.now() - new Date(project.auto_verify_at).getTime() < RETRY_WINDOW_MS
  ) {
    return { ran: false, reason: "recently-attempted" };
  }

  // Mark attempted first to prevent retry storms across concurrent renders.
  const supabase = adminClient();
  await supabase
    .from("projects")
    .update({ auto_verify_at: new Date().toISOString() })
    .eq("id", project.id);

  try {
    if (hasGitHub) {
      await fireGithubSyntheticEvent({
        origin,
        repoFullName: project.git_repo_full_name!,
        repoId: project.git_repo_id ?? 0,
        webhookSecret: project.git_webhook_secret!,
      });
    } else if (hasEcr) {
      await fireEcrSyntheticEvent({
        origin,
        token: project.ecr_webhook_token!,
        accountId: project.ecr_aws_account_id ?? "000000000000",
        repoName: project.ecr_repo_name ?? "stacklense-test",
      });
    }
    return { ran: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[auto-verify] synthetic event fire failed: ${msg}`);
    return { ran: false, reason: `fire-failed:${msg}` };
  }
}

async function fireWithTimeout(
  url: string,
  init: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FIRE_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

async function fireGithubSyntheticEvent(args: {
  origin: string;
  repoFullName: string;
  repoId: number;
  webhookSecret: string;
}) {
  const url = `${args.origin}/api/webhooks/github`;
  const payload = {
    ref: "refs/heads/main",
    repository: { full_name: args.repoFullName, id: args.repoId },
    head_commit: {
      id: randomBytes(20).toString("hex"),
      message: "stacklense: auto-verify",
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
    createHmac("sha256", args.webhookSecret).update(rawBody).digest("hex");

  await fireWithTimeout(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-GitHub-Event": "push",
      "X-Hub-Signature-256": sig,
      "X-StackLense-Synthetic": "auto-verify",
    },
    body: rawBody,
  });
}

async function fireEcrSyntheticEvent(args: {
  origin: string;
  token: string;
  accountId: string;
  repoName: string;
}) {
  const url = `${args.origin}/api/webhooks/aws/${args.token}`;
  const payload = {
    version: "0",
    id: `stacklense-auto-verify-${randomBytes(8).toString("hex")}`,
    "detail-type": "ECR Image Action",
    source: "aws.ecr",
    account: args.accountId,
    time: new Date().toISOString(),
    region: "us-east-1",
    resources: [],
    detail: {
      "action-type": "PUSH",
      result: "SUCCESS",
      "repository-name": args.repoName,
      "image-tag": "stacklense-auto-verify",
      "image-digest": `sha256:${randomBytes(32).toString("hex")}`,
    },
  };

  await fireWithTimeout(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-StackLense-Token": args.token,
      "X-StackLense-Synthetic": "auto-verify",
    },
    body: JSON.stringify(payload),
  });
}
