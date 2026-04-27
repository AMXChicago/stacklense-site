/**
 * Edge inspector — Stats tab.
 *
 * Renders `connection.frequency` and `connection.latency` when
 * present. Either field may be missing (we surface only the
 * fields that have values). When both are missing, an empty-state
 * paragraph explains that Metric Providers will fill these in.
 *
 * Why these two fields and not e.g. error rate? The spec's
 * Connection type only lists frequency + latency on the canonical
 * model; richer stats (errors, retry rates, p50/p95 splits) are
 * out of scope for v1 and would extend the data model.
 */

import type { Connection } from "@/lib/types";

export default function StatsTab({ connection }: { connection: Connection }) {
  const rows: Array<{ label: string; value: string }> = [];
  if (connection.frequency) {
    rows.push({ label: "Frequency", value: connection.frequency });
  }
  if (connection.latency) {
    rows.push({ label: "Latency", value: connection.latency });
  }

  if (rows.length === 0) {
    return (
      <div className="space-y-2 px-5 py-4 text-sm">
        <p className="font-mono text-[10px] uppercase tracking-wider text-ink3">
          Stats · empty
        </p>
        <p className="text-ink2">
          Metric Providers per platform are wired up in spec build
          step 11. Once a Provider attaches frequency / latency to
          this connection, the values land here automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 px-5 py-4">
      <p className="font-mono text-[10px] uppercase tracking-wider text-ink3">
        Stats
      </p>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li
            key={r.label}
            className="flex items-center justify-between rounded-md border border-border2 bg-bg2 px-3 py-2 text-sm"
          >
            <span className="font-mono text-[10px] uppercase tracking-wider text-ink3">
              {r.label}
            </span>
            <span className="font-mono text-ink">{r.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
