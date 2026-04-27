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
        <h1 className="dash-h1">Watch your AWS deploys</h1>
        <p className="dash-sub">
          Tell us about the project. On the next page you&rsquo;ll click one
          button in AWS to finish setup. After that, every time you ship a
          new version, we rebuild your blueprint.
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
          AWS account ID (12 digits)
        </label>
        <input
          id="ecr_account_id"
          name="ecr_account_id"
          type="text"
          required
          pattern="[0-9]{12}"
          placeholder="123456789012"
          className="login-input"
        />

        <label className="form-label" htmlFor="ecr_repo_name">
          ECR repo name (optional — leave blank to watch all repos)
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
        On the next page, click one button in AWS — everything is
        pre-filled. Takes about 60 seconds.
      </p>
    </>
  );
}
