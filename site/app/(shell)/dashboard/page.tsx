/**
 * Project list placeholder.
 *
 * The real implementation (list of projects from Supabase, "new
 * project" button → /dashboard/connect, empty state) lives in
 * features/projects/ once the dashboard is being rebuilt past the
 * cleanup phase.
 */
export default function ProjectListPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <p className="font-mono text-xs text-ink3">/dashboard placeholder</p>
      <h1 className="mt-2 text-2xl font-semibold">Your projects</h1>
      <p className="mt-2 text-sm text-ink2">
        The project list is being rebuilt. It will live in
        features/projects/ once the new dashboard is functional.
      </p>
    </div>
  );
}
