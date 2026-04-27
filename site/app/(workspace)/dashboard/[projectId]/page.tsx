/**
 * Dashboard workspace page.
 *
 * Layout history:
 *   Step 1 — Canvas only, full viewport.
 *   Step 2 — Vertical split: canvas on top, inspector beneath.
 *   Step 3 — Adds the platform-row strip above the canvas.
 *   Step 4 — Adds the breadcrumb strip above the platform row.
 *   Step 7 — Adds the activity sidebar to the left of the canvas.
 *
 *   ┌─────────────────────────────────────────────────────────┐
 *   │ Breadcrumb                                              │  36px
 *   ├─────────────────────────────────────────────────────────┤
 *   │ Platform row                                            │  44px
 *   ├──────────┬──────────────────────────────────────────────┤
 *   │          │                                              │
 *   │ Activity │            Canvas                            │  flex-1
 *   │ sidebar  │            (recursive drill-down)            │
 *   │ (200px)  │                                              │
 *   │          │                                              │
 *   ├──────────┴──────────────────────────────────────────────┤
 *   │ Inspector                                               │  280px (spec floor)
 *   └─────────────────────────────────────────────────────────┘
 *
 * The breadcrumb is the leftmost slice of the future "top bar"
 * region. The full top bar (with live indicator + mode switcher)
 * lands in its own step; for now the breadcrumb gets its own row
 * so step 4 has somewhere to render the multi-level path.
 *
 * Drill state lives entirely in the workspace store; the URL stays
 * at /dashboard/[projectId] regardless of drill depth (per spec
 * anti-pattern: "Using a separate route per drill level").
 *
 * Real project resolution still lands in step 10 (project adapter);
 * the route param is read but not used.
 */

import ActivitySidebar from "@/features/activity/ActivitySidebar";
import Breadcrumb from "@/features/breadcrumb/Breadcrumb";
import Canvas from "@/features/canvas/Canvas";
import Inspector from "@/features/inspector/Inspector";
import PlatformRow from "@/features/platforms/PlatformRow";
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
      <Breadcrumb project={SAMPLE_PROJECT} />
      <PlatformRow project={SAMPLE_PROJECT} />
      {/* Body row: sidebar on the left, canvas filling the rest.
          `min-h-0` and `min-w-0` are required on the flex children
          to honour the canvas's overflow scrolling and the sidebar's
          independent scroll. */}
      <div className="flex min-h-0 flex-1">
        <ActivitySidebar project={SAMPLE_PROJECT} />
        <div className="min-h-0 min-w-0 flex-1">
          <Canvas project={SAMPLE_PROJECT} />
        </div>
      </div>
      <div className="h-[280px] min-h-[280px]">
        <Inspector project={SAMPLE_PROJECT} />
      </div>
    </div>
  );
}
