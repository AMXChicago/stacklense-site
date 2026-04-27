/**
 * Dashboard workspace placeholder.
 *
 * Renders nothing meaningful — exists to keep the route registered
 * so the build is green during the cleanup phase. The real workspace
 * (top bar, platform row, activity sidebar, canvas, inspector) is
 * implemented across spec build steps 1-12.
 */

type Params = Promise<{ projectId: string }>;

export default async function WorkspacePage({
  params,
}: {
  params: Params;
}) {
  const { projectId } = await params;
  return (
    <main className="min-h-screen bg-bg text-ink p-6">
      <p className="font-mono text-xs text-ink3">workspace placeholder</p>
      <h1 className="mt-2 text-lg font-semibold">
        Project <span className="font-mono text-ink2">{projectId}</span>
      </h1>
      <p className="mt-1 text-sm text-ink2">
        The dashboard is being rebuilt. The recursive canvas, inspector,
        platform filter, activity sidebar, and mode switcher land in
        spec build steps 1-12.
      </p>
    </main>
  );
}
