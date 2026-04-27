"use client";

/**
 * Inspector v4 strip — the always-visible top region of the
 * inspector showing what's selected. Per spec:
 *
 *   STRIP: name + tags + status + last changed   [clear]   always visible
 *
 * Tags here are: the service kind (`platform` / `service` / etc.)
 * and the parent platform name (e.g., "AWS" for Lambda) when one
 * exists. Tags are flagged in the spec but the spec doesn't define
 * what counts as a tag; this interpretation matches what the canvas
 * already displays on the node card (kind line + platform colour
 * accent → tags here mirror that).
 *
 * The clear button calls setSelection({ kind: "none" }) on the
 * workspace store, which collapses the inspector back to its empty
 * state.
 */

import { X } from "lucide-react";
import type { Project, Service, ServiceStatus } from "@/lib/types";
import { useWorkspaceStore } from "@/store/workspace-store";
import { platformParentName } from "./lib/platform-name";
import { relativeTime } from "./lib/relative-time";

// Spec colour values verbatim from "Visual conventions > Status dots".
const STATUS_COLOR: Record<ServiceStatus, string> = {
  healthy: "#1D9E75",
  degraded: "#EF9F27",
  down: "#E24B4A",
  unknown: "#5a5a54",
};

export default function InspectorStrip({
  service,
  project,
}: {
  service: Service;
  project: Project;
}) {
  const setSelection = useWorkspaceStore((s) => s.setSelection);
  const platformName = platformParentName(service, project);
  const lastChanged = relativeTime(service.lastChangedAt);

  return (
    <header className="flex items-center gap-4 border-b border-border2 px-5 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h2 className="truncate text-base font-semibold text-ink">
            {service.name}
          </h2>
          <Tag>{service.kind}</Tag>
          {platformName && <Tag>{platformName}</Tag>}
        </div>
        <div className="mt-0.5 flex items-center gap-3 font-mono text-[10px] uppercase tracking-wider text-ink3">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: STATUS_COLOR[service.status] }}
              aria-hidden
            />
            <span>{service.status}</span>
          </span>
          {lastChanged && (
            <>
              <span aria-hidden className="text-ink3">
                ·
              </span>
              <span>changed {lastChanged}</span>
            </>
          )}
        </div>
      </div>

      <button
        type="button"
        aria-label="Clear selection"
        onClick={() => setSelection({ kind: "none" })}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border2 bg-bg2 text-ink3 transition-colors hover:border-ink3 hover:text-ink"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </header>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border border-border2 bg-bg3 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink2">
      {children}
    </span>
  );
}
