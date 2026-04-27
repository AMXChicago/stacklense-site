/**
 * Metrics tab — renders Service.metrics verbatim.
 *
 * Per spec "Metrics are pluggable": the dashboard never computes;
 * each Metric is pre-formatted by its Provider. We render
 * `metric.value` as-is and surface `metric.source` so the user can
 * see provenance.
 *
 * Step 2 fixture has empty metrics arrays — that's a valid state
 * (Providers haven't been registered yet; arrives in spec build
 * steps 11+). When metrics is empty we show a small empty state
 * that clarifies WHY (no provider) rather than a generic "no
 * metrics".
 */

import type { Service } from "@/lib/types";

export default function MetricsTab({ service }: { service: Service }) {
  if (service.metrics.length === 0) {
    return (
      <div className="space-y-2 px-5 py-4 text-sm">
        <p className="font-mono text-[10px] uppercase tracking-wider text-ink3">
          Metrics · empty
        </p>
        <p className="text-ink2">
          No metrics yet for{" "}
          <span className="text-ink">{service.name}</span>.
        </p>
        <p className="text-ink3">
          Metric Providers per platform are wired up in spec build
          step 11. Once a Provider is registered for this
          service&rsquo;s platform, values will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="px-5 py-4">
      <p className="mb-3 font-mono text-[10px] uppercase tracking-wider text-ink3">
        Metrics · {service.metrics.length}
      </p>
      <ul className="space-y-2">
        {service.metrics.map((metric, idx) => (
          // index-based key is fine here — the Metric type doesn't
          // carry a stable id and the list is fully replaced when
          // the provider re-runs.
          <li
            key={`${metric.label}-${idx}`}
            className="flex items-baseline justify-between gap-3 rounded-md border border-border2 bg-bg2 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm text-ink">{metric.label}</p>
              <p className="font-mono text-[10px] uppercase tracking-wider text-ink3">
                via {metric.source}
              </p>
            </div>
            <p className="font-mono text-base text-ink">{metric.value}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
