import Link from "next/link";
import { createAwsProject } from "./actions";

export const dynamic = "force-dynamic";

export default async function ConnectAwsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const errorMsg = params.error ? decodeURIComponent(params.error) : null;

  return (
    <>
      <div className="dash-greeting">
        <Link href="/dashboard/connect" className="connect-back">
          ← Pick a different connect method
        </Link>
        <div className="dash-section-label">Connect — AWS ECR</div>
        <h1 className="dash-h1">Watch your ECR pushes</h1>
        <p className="dash-sub">
          Tell us about the project, then run a CloudFormation template that
          installs an EventBridge rule in your AWS account. From then on,
          every ECR push triggers a blueprint update.
        </p>
      </div>

      {errorMsg && <div className="login-error">{errorMsg}</div>}

      <form action={createAwsProject} className="aws-form">
        <label className="form-label" htmlFor="project_name">
          Project name
        </label>
        <input
          id="project_name"
          name="project_name"
          type="text"
          required
          placeholder="my-app"
          className="login-input"
        />

        <label className="form-label" htmlFor="description">
          Description (optional)
        </label>
        <input
          id="description"
          name="description"
          type="text"
          placeholder="Node.js API on ECS Fargate"
          className="login-input"
        />

        <label className="form-label" htmlFor="ecr_account_id">
          AWS account ID (optional)
        </label>
        <input
          id="ecr_account_id"
          name="ecr_account_id"
          type="text"
          pattern="[0-9]{12}"
          placeholder="123456789012"
          className="login-input"
        />

        <label className="form-label" htmlFor="ecr_repo_name">
          ECR repo name (optional, leave blank to watch all repos)
        </label>
        <input
          id="ecr_repo_name"
          name="ecr_repo_name"
          type="text"
          placeholder="my-app-image"
          className="login-input"
        />

        <button type="submit" className="login-btn aws-submit">
          Continue →
        </button>
      </form>

      <p className="connect-foot" style={{ marginTop: 32 }}>
        On the next page you&rsquo;ll get a CloudFormation Quick Create link
        with everything pre-filled. Takes about 60 seconds in your AWS
        console.
      </p>
    </>
  );
}
