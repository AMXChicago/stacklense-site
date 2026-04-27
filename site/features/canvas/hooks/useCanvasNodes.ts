/**
 * Hook stub: derive React Flow nodes from the current Project +
 * workspace store state (drill stack, filter, mode).
 *
 * Created in advance per the agreed plan: spec build steps 5
 * (recursive drill-down) and 10 (live data wiring) will both need a
 * place to express how the recursive Service tree gets flattened
 * into the current drill level's visible nodes. Putting the
 * placeholder here now means future work doesn't have to invent the
 * folder.
 *
 * STUB. Real implementation lands in spec build step 1.
 */

import type { Project } from "@/lib/types";

export type CanvasNode = {
  id: string;
  // Future: position, data payload for the React Flow custom node.
  // Exact shape settles once spec step 1 lands and we know what the
  // node component expects.
};

export function useCanvasNodes(project: Project | null): CanvasNode[] {
  // TODO(spec step 1): build CanvasNode[] from the current drill
  // level of project.services using workspace-store.drillStack.
  void project;
  return [];
}
