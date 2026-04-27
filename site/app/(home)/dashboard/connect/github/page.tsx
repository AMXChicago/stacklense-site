import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { requestGitHubRepoScope, connectFromGitHubRepo } from "./actions";

export const dynamic = "force-dynamic";

type Repo = {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  html_url: string;
  language: string | null;
  pushed_at: string;
};

async function fetchRepos(token: string): Promise<Repo[] | null> {
  try {
    const r = await fetch(
      "https://api.github.com/user/repos?sort=updated&per_page=50&affiliation=owner,collaborator",
      {
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github+json",
        },
        // GitHub's repo list rarely changes minute-to-minute; cache briefly.
        next: { revalidate: 60 },
      }
    );
    if (!r.ok) return null;
    return (await r.json()) as Repo[];
  } catch {
    return null;
  }
}

export default async function ConnectGitHubPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const errorMsg = params.error ? decodeURIComponent(params.error) : null;

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // The session.provider_token is only present after a fresh OAuth login.
  const providerToken = session?.provider_token ?? null;
  const repos = providerToken ? await fetchRepos(providerToken) : null;

  return (
    <>
      <div className="dash-greeting">
        <Link href="/dashboard/connect" className="connect-back">
          ← Pick a different connect method
        </Link>
        <div className="dash-section-label">Connect — GitHub</div>
        <h1 className="dash-h1">Pick a repository</h1>
        <p className="dash-sub">
          We&rsquo;ll generate your initial blueprint from the repo&rsquo;s
          code, deploy config, and CI workflows.
        </p>
      </div>

      {errorMsg && <div className="login-error">{errorMsg}</div>}

      {!providerToken || !repos ? (
        <div className="dash-empty">
          <div className="dash-empty-icon">🔐</div>
          <h2 className="dash-empty-h2">Authorize GitHub access</h2>
          <p className="dash-empty-p">
            We need read access to your repositories to list them and analyze
            their contents. We never modify code or push commits.
          </p>
          <form action={requestGitHubRepoScope}>
            <button type="submit" className="dash-empty-cta">
              Continue with GitHub →
            </button>
          </form>
        </div>
      ) : repos.length === 0 ? (
        <div className="dash-empty">
          <h2 className="dash-empty-h2">No repos found</h2>
          <p className="dash-empty-p">
            Your GitHub account doesn&rsquo;t have any repos we can see. Check
            your GitHub account or try the AWS path instead.
          </p>
        </div>
      ) : (
        <ul className="repo-list">
          {repos.map((repo) => (
            <li key={repo.id} className="repo-item">
              <form action={connectFromGitHubRepo} className="repo-form">
                <input
                  type="hidden"
                  name="full_name"
                  value={repo.full_name}
                />
                <input
                  type="hidden"
                  name="repo_id"
                  value={repo.id}
                />
                <input
                  type="hidden"
                  name="description"
                  value={repo.description ?? ""}
                />
                <div className="repo-info">
                  <div className="repo-name">
                    {repo.full_name}
                    {repo.private && (
                      <span className="repo-private">private</span>
                    )}
                  </div>
                  {repo.description && (
                    <div className="repo-desc">{repo.description}</div>
                  )}
                  <div className="repo-meta">
                    {repo.language && <span>{repo.language}</span>}
                    {repo.language && <span> · </span>}
                    <span>
                      Updated{" "}
                      {new Date(repo.pushed_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <button type="submit" className="repo-connect-btn">
                  Connect →
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
