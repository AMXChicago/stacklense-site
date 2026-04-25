import Link from "next/link";

export default function ConnectChooserPage() {
  return (
    <>
      <div className="dash-greeting">
        <Link href="/dashboard" className="connect-back">
          ← Back to dashboard
        </Link>
        <div className="dash-section-label">Connect a project</div>
        <h1 className="dash-h1">How do you want to connect?</h1>
        <p className="dash-sub">
          Pick the path that matches your stack. You can connect multiple
          projects later.
        </p>
      </div>

      <div className="connect-chooser">
        <Link href="/dashboard/connect/github" className="connect-option">
          <div className="connect-option-icon">🐙</div>
          <div className="connect-option-name">GitHub repo</div>
          <p className="connect-option-desc">
            Pick a repo. We watch pushes and analyze your code, Dockerfile,
            CI workflows, and deploy configs to build the blueprint.
          </p>
          <div className="connect-option-meta">OAuth · 30 sec</div>
        </Link>

        <Link href="/dashboard/connect/aws" className="connect-option">
          <div className="connect-option-icon">📦</div>
          <div className="connect-option-name">AWS ECR</div>
          <p className="connect-option-desc">
            One-click CloudFormation adds an EventBridge rule that pings us
            on every ECR push. No IAM role, no AWS access — just outbound
            webhooks.
          </p>
          <div className="connect-option-meta">EventBridge · 60 sec</div>
        </Link>
      </div>

      <p className="connect-foot">
        Connect either or both. Both are read-only — StackLense never modifies
        your code or infrastructure.
      </p>
      <p className="connect-foot" style={{ marginTop: 8 }}>
        More platforms coming soon (GitLab, Bitbucket, Docker Hub, GCR).
      </p>
    </>
  );
}
