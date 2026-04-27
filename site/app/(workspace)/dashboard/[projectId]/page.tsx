/**
 * Dashboard workspace page.
 *
 * Step 1 placed the Canvas in a full-viewport container. Step 2
 * (this step) splits the viewport vertically per spec layout:
 *
 *   ┌─────────────────────────────────────────────────────────┐
 *   │                                                         │
 *   │                       Canvas                            │  flex-1
 *   │                                                         │
 *   ├─────────────────────────────────────────────────────────┤
 *   │ Inspector                                               │  280px (spec floor)
 *   └─────────────────────────────────────────────────────────┘
 *
 * The other regions in the spec layout (top bar, platform row,
 * activity sidebar) arrive in their own steps and slot into this
 * shell.
 *
 * Real project resolution still lands in step 10 (project adapter);
 * the route param is read but not used.
 */

import Canvas from "@/features/canvas/Canvas";
import Inspector from "@/features/inspector/Inspector";
import { SAMPLE_PROJECT } from "@/lib/fixtures/sample-project";

type Params = Promise<{ projectId: string }>;

export default async function WorkspacePage({
  params,
}: {
  params: Params;
}) {
  const { projectId } = await params;
  void projectId;

  return (
    <div className="flex h-screen w-screen flex-col bg-bg">
      <div className="min-h-0 flex-1">
        <Canvas project={SAMPLE_PROJECT} />
      </div>
      <div className="h-[280px] min-h-[280px]">
        <Inspector project={SAMPLE_PROJECT} />
      </div>
    </div>
  );
}
