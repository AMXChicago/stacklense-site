/**
 * Project fingerprint — stable hash representing the high-level
 * shape of a project (top-level platforms, tech stack signals). Used
 * as part of the explainer cache key per the spec's caching strategy.
 *
 *   cache key = hash(serviceId + serviceKind + parentPlatform +
 *                    projectFingerprint + explainerType)
 *
 * Adding a new function to Lambda doesn't change the project's
 * fingerprint. Adding a new database technology (or removing the
 * primary one) does. Tuned so cached explainers stay valid across
 * minor service additions but invalidate on meaningful shape change.
 *
 * STUB. Real implementation lands during spec build step 16 (LLM
 * provider + cache).
 */

import type { Project } from "./types";

/**
 * Compute a stable fingerprint string from a project. Future
 * implementation will hash a sorted, normalised summary of:
 *   - platform names (top-level Service.kind === "platform")
 *   - count of services per platform
 *   - presence of well-known signal vendors (database, auth,
 *     payments, comms)
 *
 * Returns "unfingerprinted" until step 16 fills this in so callers
 * can wire the cache key without crashing.
 */
export function projectFingerprint(project: Project): string {
  // TODO(spec step 16): port the rules above and hash with a
  // small/stable algorithm (sha-256 truncated to 16 chars is fine).
  // Reference `project` so the parameter isn't unused — the real
  // implementation will read project.services to compute the hash.
  void project;
  return "unfingerprinted";
}
