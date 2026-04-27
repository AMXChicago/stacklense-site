/**
 * Adapter: raw Supabase shape → spec Project shape.
 *
 * THE ONLY FILE in the frontend that knows both the backend's row
 * shape and the spec's normalized Project shape. Every other piece
 * of frontend code receives a `Project` object and works with it
 * directly.
 *
 * Mapping rules (per agreement during the audit):
 *
 * 1. Each unique vendor in the LLM blueprint becomes a synthesized
 *    parent Service of `kind: "platform"`. Detected components with
 *    that vendor become children Services with `kind: "service"`,
 *    `parentId` set to the platform.
 *
 * 2. Components with no detectable vendor are placed at the top
 *    level (parentId: null).
 *
 * 3. Project.rootServiceIds is the set of platform IDs plus any
 *    vendor-less components.
 *
 * 4. Connections in the blueprint reference component IDs directly
 *    (not vendor IDs); the adapter passes them through, mapping
 *    `label` to `what` and `type: "sync"` as the default until the
 *    backend tracks connection types.
 *
 * 5. Activity[] is currently empty. The deploys table gives us
 *    deploy events but the shape transform is wired up in spec
 *    build step 7 (Activity sidebar). This stub returns [].
 *
 * Defaults (commented inline so they're discoverable):
 *
 * - Service.status: "unknown" — wired up in spec build step 11
 *   (live indicators driven by real metrics).
 * - Service.metrics: [] — ships with Metric Providers later (spec
 *   build steps 11-12+).
 * - Connection.type: "sync" — placeholder until the backend
 *   classifies connections.
 *
 * AFTER this adapter is wired up in spec build step 10, add a
 * "Backend interface (current)" section to docs/blueprint-spec.md
 * documenting the Supabase columns this reads from and the rules
 * above. Keep that section in sync with this file.
 */

import type { Project } from "./types";
import type {
  ProjectRow,
  DeployRow,
} from "./supabase-shape";

export type AdaptInput = {
  project: ProjectRow;
  deploys: DeployRow[];
};

/**
 * STUB. Real implementation lands in spec build step 10. Returns an
 * empty Project shaped per spec so callers can typecheck against
 * lib/types.ts before the recursive synthesis is filled in.
 */
export function adaptProject(input: AdaptInput): Project {
  // TODO(spec step 10): synthesize platform parents per unique
  // vendor, attach components as children, map blueprint.connections
  // to spec Connection objects, derive Activity[] from deploys.
  return {
    id: input.project.id,
    name: input.project.name,
    rootServiceIds: [],
    services: {},
    connections: {},
    activity: [],
  };
}
