import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createHmac, timingSafeEqual } from "crypto";
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
 * GitHub push webhook receiver.
 *
 * Flow:
 *   1. Read raw body (we need it for HMAC verification)
 *   2. Look up project by repo full_name in payload
 *   3. Verify the X-Hub-Signature-256 HMAC matches the project's stored secret
 *   4. Insert a deploys row, kick off blueprint regeneration
 */
export async function POST(request: Request) {
  const event = request.headers.get("x-github-event");
  if (event !== "push") {
    // We only handle push for now; ack and ignore everything else.
    return NextResponse.json({ ok: true, ignored: event }, { status: 200 });
  }

  const rawBody = await request.text();
  let payload: GithubPushPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const fullName = payload.repository?.full_name;
  if (!fullName) {
    return NextResponse.json({ error: "no repo in payload" }, { status: 400 });
  }

  const supabase = adminClient();
  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, git_webhook_secret")
    .eq("git_repo_full_name", fullName);

  if (error) {
    console.error("[webhook/github] db error:", error);
    return NextResponse.json({ error: "db error" }, { status: 500 });
  }
  if (!projects || projects.length === 0) {
    // Nobody connected this repo — ack so GitHub doesn't disable our hook.
    return NextResponse.json(
      { ok: true, note: "no matching project" },
      { status: 200 }
    );
  }

  const signatureHeader = request.headers.get("x-hub-signature-256") ?? "";

  let verifiedProjectId: string | null = null;
  for (const p of projects) {
    if (!p.git_webhook_secret) continue;
    if (verifyGithubSignature(rawBody, p.git_webhook_secret, signatureHeader)) {
      verifiedProjectId = p.id;
      break;
    }
  }

  if (!verifiedProjectId) {
    console.warn("[webhook/github] hmac mismatch for repo:", fullName);
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  // Record the deploy event.
  await supabase.from("deploys").insert({
    project_id: verifiedProjectId,
    image_tag: payload.head_commit?.id?.slice(0, 7) ?? null,
    deploy_note:
      payload.head_commit?.message?.split("\n")[0]?.slice(0, 200) ?? null,
    source_type: "github",
    payload: payload as unknown as Record<string, unknown>,
  });

  await kickOffBlueprintGeneration(verifiedProjectId);

  return NextResponse.json({ ok: true }, { status: 200 });
}

function verifyGithubSignature(
  rawBody: string,
  secret: string,
  header: string
): boolean {
  if (!header.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  const expectedHeader = `sha256=${expected}`;
  // Both must be same length for timingSafeEqual.
  if (expectedHeader.length !== header.length) return false;
  try {
    return timingSafeEqual(
      Buffer.from(expectedHeader),
      Buffer.from(header)
    );
  } catch {
    return false;
  }
}

type GithubPushPayload = {
  ref?: string;
  repository?: {
    full_name?: string;
    id?: number;
  };
  head_commit?: {
    id?: string;
    message?: string;
    timestamp?: string;
    author?: { name?: string; email?: string };
  };
};
