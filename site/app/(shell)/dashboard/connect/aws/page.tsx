/**
 * AWS connect placeholder.
 *
 * Manual-setup fallback content (the legacy /setup-manual URL) will
 * live here as an expandable section, shown only after auto-install
 * fails. Real form + actions live in features/connect/.
 */
export default function ConnectAwsPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <p className="font-mono text-xs text-ink3">
        /dashboard/connect/aws placeholder
      </p>
      <h1 className="mt-2 text-2xl font-semibold">Connect via AWS</h1>
      <p className="mt-2 text-sm text-ink2">
        The connect form is being rebuilt in features/connect/. It will
        include the manual-setup fallback inline, expanded only when
        the auto-install path fails.
      </p>
    </div>
  );
}
