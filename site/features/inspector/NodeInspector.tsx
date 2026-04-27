"use client";

/**
 * Inspector for `selection.kind === "service"`. Composes the v4
 * split layout: STRIP on top, TABS + TAB BODY below. Per spec, all
 * three regions are present from step 2 onward — this is not a flat
 * panel that grows tabs later (anti-pattern v4).
 */

import type { Project, Service } from "@/lib/types";
import InspectorStrip from "./InspectorStrip";
import NodeInspectorTabs from "./NodeInspectorTabs";

export default function NodeInspector({
  service,
  project,
}: {
  service: Service;
  project: Project;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <InspectorStrip service={service} project={project} />
      <NodeInspectorTabs service={service} project={project} />
    </div>
  );
}
