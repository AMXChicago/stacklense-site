/**
 * Edge inspector — Explain tab.
 *
 * Per spec UI placement strategy / Edge inspector:
 *   "Edge inspector: tabs are `Explain | Schema | Stats`. Default
 *    tab: Explain."
 *
 * Static stand-in copy until step 16 (LLM provider + cache) wires
 * up real explainers. Same pattern as ExplainTab for nodes — the
 * panel renders instantly with deterministic text so the layout
 * is verifiable; the streaming LLM body slots in behind this
 * placeholder later without UI changes.
 */

import type { Connection, Project } from "@/lib/types";

export default function EdgeExplainTab({
  connection,
  project,
}: {
  connection: Connection;
  project: Project;
}) {
  const fromName =
    project.services[connection.fromServiceId]?.name ??
    connection.fromServiceId;
  const toName =
    project.services[connection.toServiceId]?.name ??
    connection.toServiceId;
  return (
    <div className="space-y-2 px-5 py-4 text-sm leading-relaxed">
      <p className="font-mono text-[10px] uppercase tracking-wider text-ink3">
        Explainer · placeholder
      </p>
      <p className="text-ink2">
        <span className="text-ink">
          {fromName} → {toName}
        </span>{" "}
        is a{" "}
        <span className="text-ink">
          {connection.type}
        </span>{" "}
        connection — {connection.what}
      </p>
      <p className="text-ink3">
        Plain-English edge explainers (what flows over this edge,
        why it exists, what would break if it disappeared) will be
        wired up in step 15 (static fixtures) and step 16 (LLM
        provider + cache). Until then this copy stands in so the
        layout doesn&rsquo;t shift when explainers arrive.
      </p>
    </div>
  );
}
