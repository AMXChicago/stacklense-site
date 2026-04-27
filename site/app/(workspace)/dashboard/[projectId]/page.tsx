/**
 * Dashboard workspace page.
 *
 * Step 1: renders the Canvas (recursive renderer) against a
 * hardcoded fixture Project. The route URL parameter is read but
 * NOT yet used to look up a real project — the Supabase adapter is
 * wired up in spec build step 10.
 *
 * Layout for step 1 is intentionally minimal: full-viewport canvas,
 * no top bar, no sidebar, no inspector. Those regions arrive in
 * later spec build steps.
 */

import Canvas from "@/features/canvas/Canvas";
import { SAMPLE_PROJECT } from "@/lib/fixtures/sample-project";

type Params = Promise<{ projectId: string }>;

export default async function WorkspacePage({
  params,
}: {
  params: Params;
}) {
  // The route param is read so Next.js doesn't strip it from the
  // route signature, but step 1 always renders the same fixture.
  // Real project resolution lands in step 10 (project adapter).
  const { projectId } = await params;
  void projectId;

  return (
    <div className="h-screen w-screen bg-bg">
      <Canvas project={SAMPLE_PROJECT} />
    </div>
  );
}
