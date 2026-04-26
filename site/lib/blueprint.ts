import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@supabase/ssr";
import { waitUntil } from "@vercel/functions";
import { blueprintFailedEmail, sendEmail } from "./email";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Build a Supabase client suitable for server-side admin work — uses the
 * service-role key if available so RLS doesn't block the writes we make
 * from webhooks (no user session). Falls back to the publishable key, which
 * works for actions inside an authenticated request.
 */
function adminClient() {
  return createServerClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE ?? SUPABASE_KEY,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {
          /* admin client doesn't manage cookies */
        },
      },
    }
  );
}

const anthropic = new Anthropic();
// Sonnet 4.5 — current generation as of late 2025 / early 2026.
// Original Sonnet 4 (claude-sonnet-4-20250514) returned 404 in production.
const BLUEPRINT_MODEL = "claude-sonnet-4-5-20250929";

// Hard cap so we don't burn tokens on huge repos.
const MAX_INPUT_CHARS = 200_000;

/**
 * Public entry point. Marks the project as `generating`, then schedules the
 * actual generation work to continue running after the calling request
 * returns (via Vercel's `waitUntil`).
 *
 * Caller pattern:
 *
 *   await kickOffBlueprintGeneration(projectId);
 *   redirect(`/dashboard/${projectId}`);
 *
 * The user's redirect happens in milliseconds; Claude analysis happens
 * over the next 10–30 seconds in the background.
 */
export async function kickOffBlueprintGeneration(projectId: string) {
  const supabase = adminClient();

  // Mark generating up-front so the dashboard reflects state immediately.
  await supabase
    .from("projects")
    .update({ blueprint_status: "generating", blueprint_error: null })
    .eq("id", projectId);

  waitUntil(generateBlueprint(projectId));
}

/**
 * Does the actual work. Should never throw — failures are recorded on the
 * project row and the user can re-trigger from the dashboard.
 */
async function generateBlueprint(projectId: string) {
  const supabase = adminClient();

  // Read the prior status BEFORE we change it so we can decide whether
  // to email on failure (only on transitions into 'failed', not on every
  // retry attempt that fails again).
  const { data: priorRow } = await supabase
    .from("projects")
    .select("blueprint_status, user_id, name")
    .eq("id", projectId)
    .single();
  const priorStatus = priorRow?.blueprint_status ?? null;

  try {
    const { data: project, error } = await supabase
      .from("projects")
      .select(
        "id, name, description, git_host, git_repo_full_name, ecr_aws_account_id, ecr_repo_name"
      )
      .eq("id", projectId)
      .single();
    if (error || !project) throw new Error(error?.message ?? "project not found");

    const sourceContext = await collectSourceContext(project);
    const blueprint = await callClaude(project, sourceContext);

    await supabase
      .from("projects")
      .update({
        blueprint,
        blueprint_status: "ready",
        blueprint_generated_at: new Date().toISOString(),
        blueprint_error: null,
      })
      .eq("id", projectId);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(
      `[blueprint] generation failed for project ${projectId}:`,
      message
    );
    await supabase
      .from("projects")
      .update({
        blueprint_status: "failed",
        blueprint_error: message,
      })
      .eq("id", projectId);

    // Only email on a transition INTO failed — don't spam users who hit
    // Regenerate on a project that's already in a failed state.
    if (priorStatus !== "failed" && priorRow?.user_id && priorRow?.name) {
      await sendBlueprintFailedEmail({
        userId: priorRow.user_id,
        projectId,
        projectName: priorRow.name,
        error: message,
      });
    }
  }
}

/**
 * Look up the user's email by their auth user id and send the failure
 * notification. Failures here are logged but never re-thrown — we don't
 * want email problems to corrupt the blueprint pipeline state.
 */
async function sendBlueprintFailedEmail(args: {
  userId: string;
  projectId: string;
  projectName: string;
  error: string;
}) {
  try {
    const supabase = adminClient();
    const { data, error } = await supabase.auth.admin.getUserById(args.userId);
    const email = data?.user?.email;
    if (error || !email) {
      console.warn(
        "[blueprint] could not resolve user email for failure alert:",
        error?.message
      );
      return;
    }
    const tmpl = blueprintFailedEmail({
      projectName: args.projectName,
      projectId: args.projectId,
      error: args.error,
    });
    const result = await sendEmail({
      to: email,
      subject: tmpl.subject,
      html: tmpl.html,
    });
    if (!result.ok) {
      console.warn("[blueprint] failure email did not send:", result.reason);
    }
  } catch (e) {
    console.error(
      "[blueprint] sendBlueprintFailedEmail threw:",
      e instanceof Error ? e.message : String(e)
    );
  }
}

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  git_host: string | null;
  git_repo_full_name: string | null;
  ecr_aws_account_id: string | null;
  ecr_repo_name: string | null;
};

/**
 * Collect whatever source data we can given the connected sources. For
 * GitHub we fetch a tarball of the repo and pull text out. For ECR-only
 * projects we have no code, so we hand Claude the metadata only.
 */
async function collectSourceContext(project: ProjectRow): Promise<string> {
  const chunks: string[] = [];

  chunks.push(
    `# Project: ${project.name}\n\n` +
      (project.description ? `Description: ${project.description}\n\n` : "")
  );

  if (project.git_host === "github" && project.git_repo_full_name) {
    chunks.push(`## GitHub source\n\nRepo: ${project.git_repo_full_name}\n`);
    // For now we just include the README and a few canonical config files.
    // A future iteration can fetch the full tarball, but that's heavier.
    const fileList = [
      "README.md",
      "package.json",
      "Dockerfile",
      "docker-compose.yml",
      "next.config.mjs",
      "next.config.js",
      "vercel.json",
      "supabase/config.toml",
      ".github/workflows/deploy.yml",
      "CLAUDE.md",
      "AGENTS.md",
    ];
    for (const path of fileList) {
      const content = await fetchPublicGitHubFile(
        project.git_repo_full_name,
        path
      );
      if (content) {
        chunks.push(`### ${path}\n\n\`\`\`\n${content}\n\`\`\`\n`);
      }
    }
  }

  if (project.ecr_aws_account_id) {
    chunks.push(
      `## AWS ECR source\n\nAccount: ${project.ecr_aws_account_id}\n` +
        (project.ecr_repo_name ? `Repo: ${project.ecr_repo_name}\n` : "")
    );
  }

  let text = chunks.join("\n");
  if (text.length > MAX_INPUT_CHARS) {
    text = text.slice(0, MAX_INPUT_CHARS) + "\n... [truncated]";
  }
  return text;
}

/**
 * Best-effort fetch of a single file from GitHub via the unauth contents API.
 * Returns null on any failure — generation should keep going even if a
 * specific file isn't there.
 */
async function fetchPublicGitHubFile(
  fullName: string,
  path: string
): Promise<string | null> {
  try {
    const r = await fetch(
      `https://api.github.com/repos/${fullName}/contents/${path}`,
      {
        headers: { Accept: "application/vnd.github.raw" },
        // Cache-bust on each generation
        cache: "no-store",
      }
    );
    if (!r.ok) return null;
    const text = await r.text();
    return text.length > 30_000 ? text.slice(0, 30_000) + "\n[truncated]" : text;
  } catch {
    return null;
  }
}

const SYSTEM_PROMPT = `You are StackLense, an architecture documentation generator. Given source files and metadata for a project, produce a structured JSON blueprint that captures the architecture, decisions, security posture, and risks.

Your output MUST be valid JSON matching this shape:

{
  "summary": "2-3 sentence plain-English overview of what this app is and how it's built",
  "services": [
    { "name": "string", "kind": "frontend|api|database|queue|cache|storage|cdn|auth|email|other", "description": "string", "evidence": "string (where you saw it)" }
  ],
  "data_flows": [
    { "from": "service name", "to": "service name", "what": "description of what flows" }
  ],
  "decisions": [
    { "title": "string", "category": "arch|infra|security|data|ops", "risk": "low|medium|high", "rationale": "why this choice was made (inferred or explicit)", "evidence": "string" }
  ],
  "security_flags": [
    { "title": "string", "severity": "info|low|medium|high|critical", "description": "string", "remediation": "string" }
  ],
  "open_questions": [
    "things you couldn't determine from the source"
  ]
}

Rules:
- Output JSON ONLY. No prose before or after.
- Be specific: cite file paths and line patterns in "evidence".
- "open_questions" should be empty if you have enough info; otherwise list specific gaps.
- Don't invent services or decisions; only include what the source supports.`;

async function callClaude(
  project: ProjectRow,
  sourceContext: string
): Promise<unknown> {
  const userPrompt = `Generate a blueprint for the following project.\n\n${sourceContext}`;

  const message = await anthropic.messages.create({
    model: BLUEPRINT_MODEL,
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  // Extract text content
  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text content");
  }
  const raw = textBlock.text.trim();

  // Strip ```json fences if Claude wrapped despite instructions
  const json = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "");

  try {
    return JSON.parse(json);
  } catch (e) {
    throw new Error(
      `Claude returned invalid JSON: ${
        e instanceof Error ? e.message : String(e)
      }\n\nFirst 500 chars: ${raw.slice(0, 500)}`
    );
  }
}
