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
            Pick a repo, we&rsquo;ll watch it for changes and infer your stack
            from the code, deploy config, and CI workflows.
          </p>
          <div className="connect-option-meta">OAuth · 30 sec</div>
        </Link>

        <Link href="/dashboard/connect/aws" className="connect-option">
          <div className="connect-option-icon">☁️</div>
          <div className="connect-option-name">AWS account</div>
          <p className="connect-option-desc">
            One-click CloudFormation creates a read-only IAM role + EventBridge
            rule. We watch ECR pushes and read your live infrastructure.
          </p>
          <div className="connect-option-meta">IAM Role · 60 sec</div>
        </Link>
      </div>

      <p className="connect-foot">
        Both paths are read-only. StackLense can never modify your code or
        infrastructure. <Link href="/security">Security details</Link>
      </p>
    </>
  );
}
