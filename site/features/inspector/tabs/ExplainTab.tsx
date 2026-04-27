/**
 * Explain tab — placeholder for step 2.
 *
 * Per spec UI placement strategy (inline-everywhere): explainers
 * live in the default Inspector view as the FIRST tab. A vibe coder
 * shouldn't have to switch into a special mode to learn — the
 * explanation is the primary content.
 *
 * Real LLM-streamed content lands in spec build step 16, with
 * static fixture explainers as a layout dry-run in step 15. Step 2
 * just needs the tab to exist with placeholder copy so the v4 split
 * (strip + tabs + tabbody) is in place from the start.
 */

import type { Service } from "@/lib/types";

export default function ExplainTab({ service }: { service: Service }) {
  return (
    <div className="space-y-3 px-5 py-4 text-sm leading-relaxed text-ink2">
      <p className="font-mono text-[10px] uppercase tracking-wider text-ink3">
        Explainer · placeholder
      </p>
      <p>
        <span className="font-medium text-ink">{service.name}</span> is a{" "}
        <span className="text-ink">{service.kind}</span>
        {service.description ? (
          <>
            {" "}— {service.description}
          </>
        ) : (
          "."
        )}
      </p>
      <p className="text-ink3">
        Plain-English explainers (what this is, why it&rsquo;s here,
        alternatives) will be wired up in step 15 (static fixtures) and
        step 16 (LLM provider + cache). For now, the tab structure is
        in place so the layout doesn&rsquo;t shift when explainers
        arrive.
      </p>
    </div>
  );
}
