/**
 * Connect entry placeholder. Pick AWS or GitHub.
 *
 * The real connect picker lives in features/connect/ once it's
 * rebuilt. Spec build steps don't include connect-flow rebuild
 * explicitly — it's a parallel task that can happen any time after
 * the workspace exists.
 */
import Link from "next/link";

export default function ConnectPickerPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <p className="font-mono text-xs text-ink3">/dashboard/connect placeholder</p>
      <h1 className="mt-2 text-2xl font-semibold">Connect a project</h1>
      <p className="mt-2 text-sm text-ink2">
        Pick where your project lives.
      </p>
      <div className="mt-6 flex flex-col gap-3">
        <Link
          href="/dashboard/connect/aws"
          className="rounded-lg border border-border2 bg-bg2 px-4 py-3 hover:border-ink3"
        >
          <span className="block font-medium">AWS (ECR + introspection)</span>
          <span className="block text-xs text-ink3">
            Read-only IAM role, EventBridge webhooks
          </span>
        </Link>
        <Link
          href="/dashboard/connect/github"
          className="rounded-lg border border-border2 bg-bg2 px-4 py-3 hover:border-ink3"
        >
          <span className="block font-medium">GitHub repo</span>
          <span className="block text-xs text-ink3">Push webhooks</span>
        </Link>
      </div>
    </div>
  );
}
