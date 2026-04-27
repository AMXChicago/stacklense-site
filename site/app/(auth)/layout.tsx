/**
 * Auth layout — minimal centered shell for /login and any future
 * auth-flow routes. Deliberately spare: no top nav, no project
 * chrome.
 *
 * This route group exists separately from (shell) so that the
 * "you're signed in" chrome doesn't render around the sign-in
 * form. Anyone visiting /login is by definition not signed in yet.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-bg text-ink">
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
        {children}
      </main>
    </div>
  );
}
