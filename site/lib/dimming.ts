/**
 * Shared dimming module — the single source of truth for the
 * "dim non-matching" visual treatment.
 *
 * Per the spec, dimming is one visual concept used in three places:
 *   - Step 3: platform filter chips (this file's `dimmedByPlatformFilter`)
 *   - Step 4: drill-down (out-of-drill subtree dimmed — added later)
 *   - Step 9: data-flow trace mode (off-path nodes dimmed — added later)
 *
 * All three modes funnel through the same constant + edge rule so
 * dimming looks identical regardless of why a node is dimmed. The
 * decision logic (which IDs end up in the dimmed set) varies per
 * mode, but the visual application does not. Do NOT introduce a
 * parallel "filtered" / "off-path" / "dimmed" CSS class — apply
 * `DIMMED_OPACITY` directly via inline style and let the
 * Canvas/CanvasNode read the per-node `isDimmed` flag.
 *
 * Spec rules encoded here:
 *
 *   Color rules > Non-platform services
 *   ───────────────────────────────────
 *     "Non-platform services (e.g., User actor, external clients)
 *     render in neutral gray. They are exempt from platform
 *     filtering — always visible regardless of which platform chip
 *     is active."
 *
 *     Implementation: `dimmedByPlatformFilter` walks each visible
 *     service to its top-level ancestor; if that ancestor is NOT a
 *     `kind: "platform"` service, the visible service is exempt
 *     (never added to the dimmed set). Top-level non-platform
 *     services like the User actor are top-level themselves and
 *     pass through with no chip.
 *
 *   Interactions > Filtering > Edges
 *   ────────────────────────────────
 *     "Edges connecting two visible nodes stay visible; edges with
 *     one dimmed end inherit the dimmer opacity."
 *
 *     Implementation: `isEdgeDimmed` returns true if EITHER endpoint
 *     is in the dimmed set. The edge's effective opacity is then
 *     `DIMMED_OPACITY`; the underlying connection-type style
 *     (solid/dashed/webhook color) is preserved.
 */

import type { Project, Service } from "@/lib/types";

/**
 * Spec value: "Off-path nodes dim to ~16% opacity" (Modes > Data
 * flow). The same opacity is reused for the platform filter so the
 * three dimming sources are visually indistinguishable.
 */
export const DIMMED_OPACITY = 0.16;

/**
 * Walk upward through `parentId` until we hit a service with
 * `parentId === null`. The top-level ancestor of a top-level
 * service is itself. Returns the ancestor's id.
 *
 * Defensive: if the chain is malformed (a parentId points to a
 * service that doesn't exist), we stop and return whatever we have.
 * This avoids infinite loops on bad fixtures.
 */
export function topLevelAncestorId(
  service: Service,
  project: Project
): string {
  let current: Service = service;
  while (current.parentId !== null) {
    const parent = project.services[current.parentId];
    if (!parent) break;
    current = parent;
  }
  return current.id;
}

/**
 * Compute the set of visible service IDs that should be DIMMED for
 * the given platform filter selection.
 *
 *   - Empty filter → empty set (nothing is dimmed; "All" is on).
 *   - Non-empty filter → every visible service whose top-level
 *     ancestor is a Platform NOT in the filter is dimmed.
 *   - Visible services whose top-level ancestor is NOT a Platform
 *     (e.g. the User actor — top-level, kind: "service") are
 *     EXEMPT and never dimmed by this rule.
 *
 * `visibleIds` is the set the canvas is currently rendering — at
 * top level that's `project.rootServiceIds`, deeper drills pass the
 * subtree's children. The function is drill-level agnostic; pass
 * whatever the canvas displays and it will dim the right subset.
 */
export function dimmedByPlatformFilter(
  visibleIds: readonly string[],
  filter: ReadonlySet<string>,
  project: Project
): ReadonlySet<string> {
  if (filter.size === 0) return EMPTY_SET;
  const dimmed = new Set<string>();
  for (const id of visibleIds) {
    const svc = project.services[id];
    if (!svc) continue;
    const ancestorId = topLevelAncestorId(svc, project);
    const ancestor = project.services[ancestorId];
    if (!ancestor) continue;
    // Non-platform exemption: User actor and any other top-level
    // `kind: "service"` are always full opacity regardless of
    // which chip is active. Spec: color rules > non-platform.
    if (ancestor.kind !== "platform") continue;
    if (!filter.has(ancestorId)) dimmed.add(id);
  }
  return dimmed;
}

/**
 * Edge inheritance rule: an edge is dimmed if EITHER endpoint is
 * dimmed. Used by the canvas after both endpoints have been
 * (potentially) rolled up to visible ancestors — the edge's
 * `source`/`target` IDs in the React Flow Edge already match the
 * visible-set IDs.
 */
export function isEdgeDimmed(
  source: string,
  target: string,
  dimmedIds: ReadonlySet<string>
): boolean {
  return dimmedIds.has(source) || dimmedIds.has(target);
}

const EMPTY_SET: ReadonlySet<string> = new Set();
