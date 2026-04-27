/**
 * Login placeholder.
 *
 * The real login form (magic-link input + GitHub OAuth button +
 * inline error/confirmation states) lives in features/auth/. This
 * placeholder exists only to keep the route registered during the
 * cleanup phase.
 *
 * Server actions for sign-in already live at
 * features/auth/actions.ts (startMagicLinkSignIn, startGitHubSignIn)
 * — they are functional re-implementations of the legacy actions
 * with a typed AuthResult union, ready for the form component to
 * consume.
 */
export default function LoginPage() {
  return (
    <div>
      <p className="font-mono text-xs text-ink3">/login placeholder</p>
      <h1 className="mt-2 text-2xl font-semibold">Sign in</h1>
      <p className="mt-2 text-sm text-ink2">
        The login form is being rebuilt in features/auth/. Server
        actions (startMagicLinkSignIn, startGitHubSignIn) already exist
        with new typed return signatures.
      </p>
    </div>
  );
}
