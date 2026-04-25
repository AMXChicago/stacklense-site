import Link from "next/link";
import { signInWithMagicLink, signInWithGitHub } from "./actions";

type LoginSearchParams = {
  error?: string;
  sent?: string;
  next?: string;
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<LoginSearchParams>;
}) {
  const params = await searchParams;
  const errorMsg = params.error ? decodeURIComponent(params.error) : null;
  const sentTo = params.sent ? decodeURIComponent(params.sent) : null;

  return (
    <div className="login-shell">
      <div className="login-card">
        <Link href="/" className="nav-logo login-logo">
          <div className="nav-logo-mark"></div>
          StackLense
        </Link>

        <h1 className="login-h1">
          {sentTo ? "Check your inbox" : "Sign in"}
        </h1>

        {!sentTo && (
          <p className="login-sub">
            Welcome. Pick how you want to sign in.
          </p>
        )}

        {errorMsg && <div className="login-error">{errorMsg}</div>}

        {sentTo ? (
          <div className="login-sent">
            <div className="login-sent-icon">✓</div>
            <p>
              We sent a magic link to <strong>{sentTo}</strong>.
              <br />
              Click it to finish signing in.
            </p>
            <Link href="/login" className="login-link">
              Use a different email
            </Link>
          </div>
        ) : (
          <>
            <form action={signInWithMagicLink} className="login-form">
              <input
                name="email"
                type="email"
                required
                placeholder="your@email.com"
                autoComplete="email"
                className="login-input"
                aria-label="Email address"
              />
              <button type="submit" className="login-btn">
                Send magic link →
              </button>
            </form>

            <div className="login-divider">
              <span>or</span>
            </div>

            <form action={signInWithGitHub}>
              <button
                type="submit"
                className="login-btn login-btn-secondary"
              >
                Continue with GitHub
              </button>
            </form>
          </>
        )}

        <p className="login-foot">
          By continuing you agree to our{" "}
          <Link href="/terms">Terms</Link> and{" "}
          <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
