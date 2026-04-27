/**
 * Walk a Service's parentId chain to find the top-level platform it
 * belongs to. Used by the inspector strip's tag row.
 *
 * If the service IS top-level (parentId === null), it is its own
 * platform — return null so the caller can avoid showing a redundant
 * "AWS / AWS" pair when the user clicks the AWS node itself.
 */

import type { Project, Service } from "@/lib/types";

export function platformParentName(
  service: Service,
  project: Project
): string | null {
  if (service.parentId === null) return null;
  let current: Service | undefined = project.services[service.parentId];
  while (current) {
    if (current.parentId === null) return current.name;
    current = project.services[current.parentId];
  }
  return null;
}
