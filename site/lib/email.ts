import "server-only";

import { Resend } from "resend";

const FROM_DEFAULT = "StackLense <noreply@stacklense.com>";

/**
 * Send a transactional email via Resend.
 *
 * No-op if RESEND_API_KEY is missing — we don't want to crash blueprint
 * generation just because the email integration isn't configured. Caller
 * gets `{ ok: false, reason: "no-api-key" }` and can keep going.
 */
export async function sendEmail(args: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}): Promise<{ ok: true; id: string } | { ok: false; reason: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(
      "[email] RESEND_API_KEY not set — skipping send to",
      args.to,
      `(subject: ${args.subject})`
    );
    return { ok: false, reason: "no-api-key" };
  }

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: args.from ?? FROM_DEFAULT,
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text ?? stripHtml(args.html),
    });
    if (error) {
      console.error("[email] resend error:", error);
      return { ok: false, reason: error.message ?? "resend-error" };
    }
    return { ok: true, id: data?.id ?? "" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[email] send threw:", msg);
    return { ok: false, reason: msg };
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&rsquo;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// ----------------------------------------------------------------------------
// Templates
// ----------------------------------------------------------------------------

const SHELL = (body: string) => `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:32px 16px;background:#0c0c0a;color:#f0efe8;font-family:Helvetica,Arial,sans-serif;line-height:1.6;">
  <div style="max-width:560px;margin:0 auto;padding:36px 32px;background:#111110;border:1px solid rgba(255,255,255,0.08);border-radius:12px;">
    <div style="font-family:'Courier New',monospace;font-size:13px;color:#f0efe8;margin-bottom:32px;">
      <span style="display:inline-block;width:18px;height:18px;border:1.5px solid #3dd68c;border-radius:5px;background:#3dd68c;vertical-align:middle;margin-right:8px;"></span>
      StackLense
    </div>
    ${body}
    <p style="font-family:'Courier New',monospace;font-size:11px;color:#5a5a54;margin-top:40px;">
      You're getting this because you have a project on StackLense.
      <a href="https://stacklense.com/dashboard" style="color:#a8a79f;">Manage your projects</a>
    </p>
  </div>
</body></html>
`;

export function blueprintFailedEmail(args: {
  projectName: string;
  projectId: string;
  error: string;
}) {
  return {
    subject: `Blueprint build failed — ${args.projectName}`,
    html: SHELL(`
      <h1 style="font-family:Georgia,serif;font-weight:400;font-size:24px;color:#f0efe8;margin:0 0 12px;line-height:1.2;">Couldn't build your blueprint</h1>
      <p style="font-size:14px;color:#a8a79f;margin:0 0 20px;">
        We hit an error trying to build a fresh blueprint for <strong style="color:#f0efe8;">${escapeHtml(args.projectName)}</strong>.
      </p>
      <div style="font-family:'Courier New',monospace;font-size:12px;color:#ef4444;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:12px 14px;margin:0 0 24px;word-break:break-word;">
        ${escapeHtml(args.error.slice(0, 500))}
      </div>
      <p style="margin:0 0 24px;">
        <a href="https://stacklense.com/dashboard/${args.projectId}" style="display:inline-block;font-family:'Courier New',monospace;font-size:13px;padding:10px 20px;background:#3dd68c;color:#0c0c0a;text-decoration:none;border-radius:8px;font-weight:500;">Retry on the project page →</a>
      </p>
      <p style="font-size:13px;color:#a8a79f;margin:0;">
        If this keeps happening, reply to this email and we'll dig in.
      </p>
    `),
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
