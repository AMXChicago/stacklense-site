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
            Pick a repo. We&rsquo;ll watch your code and build a fresh
            blueprint every time you push.
          </p>
          <div className="connect-option-meta">Sign in · 30 sec</div>
        </Link>

        <Link href="/dashboard/connect/aws" className="connect-option">
          <div className="connect-option-icon">📦</div>
          <div className="connect-option-name">AWS ECR</div>
          <p className="connect-option-desc">
            We&rsquo;ll watch AWS for new versions of your app and rebuild
            the blueprint each time. One click in AWS, read-only — we
            don&rsquo;t touch anything.
          </p>
          <div className="connect-option-meta">One AWS click · 60 sec</div>
        </Link>
      </div>

      <p className="connect-foot">
        Pick either or both. We never modify your code or your AWS — read
        only.
      </p>
      <p className="connect-foot" style={{ marginTop: 8 }}>
        More platforms coming soon (GitLab, Bitbucket, Docker Hub, GCR).
      </p>
    </>
  );
}
