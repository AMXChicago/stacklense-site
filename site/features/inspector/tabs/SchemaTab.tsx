/**
 * Edge inspector — Schema tab.
 *
 * Renders `connection.schema` verbatim in a monospace block when
 * present. Empty state otherwise.
 *
 * The spec doesn't prescribe a format for `schema` — it's a free-
 * text field on the Connection type. The fixture uses URL +
 * curl-style JSON for HTTP, SES SendEmail JSON for SES, etc.
 * Until step 16 (LLM provider) we render whatever's in the model
 * pre-formatted; later, a wrapJargon() pass per the spec's
 * education-layer plan will underline glossary terms inline.
 */

import type { Connection } from "@/lib/types";

export default function SchemaTab({ connection }: { connection: Connection }) {
  if (!connection.schema) {
    return (
      <div className="space-y-2 px-5 py-4 text-sm">
        <p className="font-mono text-[10px] uppercase tracking-wider text-ink3">
          Schema · none
        </p>
        <p className="text-ink2">
          No schema captured for this connection yet. The
          introspection layer (step 10) will populate this for
          edges that carry structured payloads.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-2 px-5 py-4">
      <p className="font-mono text-[10px] uppercase tracking-wider text-ink3">
        Sample payload
      </p>
      {/* Pre-formatted block. `whitespace-pre-wrap` so long lines
          wrap rather than producing horizontal scroll inside the
          280px-min-height inspector. */}
      <pre className="overflow-x-auto rounded-md border border-border2 bg-bg2 p-3 font-mono text-[11px] leading-relaxed text-ink2 whitespace-pre-wrap">
        {connection.schema}
      </pre>
    </div>
  );
}
