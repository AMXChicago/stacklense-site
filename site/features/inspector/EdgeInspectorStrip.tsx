"use client";

/**
 * Edge-inspector strip — the always-visible top region of the
 * inspector when a Connection is selected. Mirrors the v4 split
 * layout used by NodeInspectorStrip:
 *
 *   STRIP: from → to · type · last changed   [clear]   always visible
 *
 * For rolled-up edges (multiple underlying connections collapsed
 * into one rendered edge), the strip surfaces the FIRST underlying
 * connection's `from` and `to`. The user can see how many
 * connections rolled into the rendered edge via the "+N more"
 * count when applicable.
 */

import { X } from "lucide-react";
import type {
  Connection,
  ConnectionType,
  Project,
} from "@/lib/types";
import { useWorkspaceStore } from "@/store/workspace-store";
import { relativeTime } from "./lib/relative-time";

const CONNECTION_TYPE_TONE: Record<
  ConnectionType,
  { label: string; className: string }
> = {
  sync: { label: "sync", className: "border-border2 bg-bg3 text-ink2" },
  async: { label: "async", className: "border-border2 bg-bg3 text-ink2" },
  event: { label: "event", className: "border-border2 bg-bg3 text-ink2" },
  webhook: {
    label: "webhook",
    // Same arbitrary rgba pattern used in ConnectionsTab — our
    // Tailwind palette exposes --amber as a CSS variable, which
    // doesn't compose with `/40`/`/10` opacity modifiers.
    className:
      "border-[rgba(245,158,11,0.4)] bg-[rgba(245,158,11,0.1)] text-amber",
  },
};

export default function EdgeInspectorStrip({
  connection,
  project,
  rolledUpExtras,
}: {
  connection: Connection;
  project: Project;
  /** Count of additional connections rolled into the same rendered
   *  edge (0 when this is the only one). Surfaced as "+N more". */
  rolledUpExtras: number;
}) {
  const setSelection = useWorkspaceStore((s) => s.setSelection);
  const fromName =
    project.services[connection.fromServiceId]?.name ??
    connection.fromServiceId;
  const toName =
    project.services[connection.toServiceId]?.name ??
    connection.toServiceId;
  const lastChanged = relativeTime(connection.lastChangedAt);
  const tone = CONNECTION_TYPE_TONE[connection.type];

  return (
    <header className="flex items-center gap-4 border-b border-border2 px-5 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 truncate">
          <h2 className="truncate text-base font-semibold text-ink">
            {fromName}
            <span aria-hidden className="mx-2 text-ink3">
              →
            </span>
            {toName}
          </h2>
          <span
            className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${tone.className}`}
          >
            {tone.label}
          </span>
          {rolledUpExtras > 0 && (
            // "+N more" hint when this rendered edge collapses
            // multiple underlying connections (e.g. a platform
            // group at top level may aggregate sync + async edges
            // from many functions).
            <span className="shrink-0 rounded border border-border2 bg-bg3 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink3">
              +{rolledUpExtras} more
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-ink2">
          {connection.what}
        </p>
        {lastChanged && (
          <div className="mt-0.5 flex items-center gap-3 font-mono text-[10px] uppercase tracking-wider text-ink3">
            <span>changed {lastChanged}</span>
          </div>
        )}
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
