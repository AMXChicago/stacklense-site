import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { kickOffBlueprintGeneration } from "@/lib/blueprint";

export const runtime = "nodejs";

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

/**
 * AWS EventBridge → API destination receiver.
 *
 * The customer's CloudFormation template installed an EventBridge rule on
 * ECR push events. The rule targets an API destination that POSTs here
 * with two pieces of identification:
 *   - The `:token` URL segment (matches projects.ecr_webhook_token)
 *   - An `X-StackLense-Token` header (same value, defense in depth)
 *
 * EventBridge sends the event payload as the request body.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!token || token.length < 32) {
    return NextResponse.json({ error: "bad token" }, { status: 400 });
  }

  const headerToken = request.headers.get("x-stacklense-token");
  if (headerToken && headerToken !== token) {
    // If header is provided it must match — early reject for misconfig.
    return NextResponse.json({ error: "token mismatch" }, { status: 401 });
  }

  const supabase = adminClient();
  const { data: project, error } = await supabase
    .from("projects")
    .select("id, ecr_repo_name, ecr_aws_account_id")
    .eq("ecr_webhook_token", token)
    .single();

  if (error || !project) {
    return NextResponse.json({ error: "unknown token" }, { status: 404 });
  }

  let payload: AwsEcrPushEvent;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  // Optional repo filter — if user specified a particular ECR repo, ignore
  // events from other repos in the same account.
  const eventRepo = payload.detail?.["repository-name"];
  if (project.ecr_repo_name && eventRepo && project.ecr_repo_name !== eventRepo) {
    return NextResponse.json({ ok: true, ignored: "repo filter" });
  }

  // Backfill ECR account ID and repo name from the event payload if the
  // project was connected without them (the form fields are optional).
  // Once we know them, we keep the values for richer blueprint context.
  const eventAccount = payload.account ?? null;
  const backfill: Record<string, string> = {};
  if (!project.ecr_aws_account_id && eventAccount) {
    backfill.ecr_aws_account_id = eventAccount;
  }
  if (!project.ecr_repo_name && eventRepo) {
    backfill.ecr_repo_name = eventRepo;
  }
  if (Object.keys(backfill).length > 0) {
    await supabase.from("projects").update(backfill).eq("id", project.id);
  }

  await supabase.from("deploys").insert({
    project_id: project.id,
    image_tag: payload.detail?.["image-tag"] ?? null,
    deploy_note:
      payload.detail?.["repository-name"] && eventRepo
        ? `ECR push: ${eventRepo}:${
            payload.detail?.["image-tag"] ?? "(no tag)"
          }`
        : null,
    source_type: "ecr",
    payload: payload as unknown as Record<string, unknown>,
  });

  await kickOffBlueprintGeneration(project.id);

  return NextResponse.json({ ok: true }, { status: 200 });
}

type AwsEcrPushEvent = {
  source?: string; // "aws.ecr"
  "detail-type"?: string; // "ECR Image Action"
  detail?: {
    "action-type"?: string; // "PUSH"
    result?: string; // "SUCCESS"
    "repository-name"?: string;
    "image-tag"?: string;
    "image-digest"?: string;
  };
  account?: string;
  time?: string;
  region?: string;
};
