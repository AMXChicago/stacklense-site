/**
 * Connections tab — renders the in/out connection lists for the
 * selected service.
 *
 * Uses the same edge roll-up rule as the canvas (per spec, locked
 * during step 2 ambiguity resolution): the set shown here equals
 * the set of edges touching the selected node in the canvas at the
 * current drill level. Roll-up is delegated to
 * connectionsForSelected, which reuses the canvas's
 * rollUpToVisible.
 *
 * Step 2: read-only display. Click handlers on connection rows
 * arrive in step 6 (edge inspector) — clicking a row will switch
 * the inspector into edge mode. Step 2 deliberately ships them as
 * non-interactive list items.
 */

import type { Service } from "@/lib/types";
import type { ConnectionView } from "../lib/connections-for";

export default function ConnectionsTab({
  service,
  outgoing,
  incoming,
}: {
  service: Service;
  outgoing: ConnectionView[];
  incoming: ConnectionView[];
}) {
  if (outgoing.length === 0 && incoming.length === 0) {
    return (
      <div className="space-y-2 px-5 py-4 text-sm">
        <p className="font-mono text-[10px] uppercase tracking-wider text-ink3">
          Connections · none
        </p>
        <p className="text-ink2">
          <span className="text-ink">{service.name}</span> doesn&rsquo;t
          have any connections at the current drill level.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-5 py-4">
      <Section
        label={`Outgoing · ${outgoing.length}`}
        connections={outgoing}
        emptyText={`${service.name} doesn't send anywhere.`}
      />
      <Section
        label={`Incoming · ${incoming.length}`}
        connections={incoming}
        emptyText={`${service.name} doesn't receive anything.`}
      />
    </div>
  );
}

function Section({
  label,
  connections,
  emptyText,
}: {
  label: string;
  connections: ConnectionView[];
  emptyText: string;
}) {
  return (
    <div>
      <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-ink3">
        {label}
      </p>
      {connections.length === 0 ? (
        <p className="text-xs text-ink3">{emptyText}</p>
      ) : (
        <ul className="space-y-1.5">
          {connections.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-3 rounded-md border border-border2 bg-bg2 px-3 py-2 text-sm"
            >
              <span
                aria-hidden
                className="font-mono text-xs text-ink3"
              >
                {c.direction === "out" ? "→" : "←"}
              </span>
              <span className="flex-1 truncate text-ink">
                {c.otherServiceName}
              </span>
              <ConnectionTypePill type={c.type} />
              <span className="hidden truncate text-xs text-ink3 sm:block sm:max-w-[40%]">
                {c.what}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ConnectionTypePill({
  type,
}: {
  type: ConnectionView["type"];
}) {
  // Tone-only pill. Status-style colour rules (color encodes platform
  // not state) don't apply to edge type — this is a property of the
  // connection itself, so a small colour cue is fine.
  const meta: Record<
    ConnectionView["type"],
    { label: string; className: string }
  > = {
    sync: {
      label: "sync",
      className: "border-border2 bg-bg3 text-ink2",
    },
    async: {
      label: "async",
      className: "border-border2 bg-bg3 text-ink2",
    },
    event: {
      label: "event",
      className: "border-border2 bg-bg3 text-ink2",
    },
    webhook: {
      // Arbitrary rgba values used here because our Tailwind config
      // exposes --amber as a CSS variable, which doesn't compose with
      // Tailwind's `/40` `/10` opacity modifiers. Using arbitrary
      // rgba keeps the colour identical to the canvas's webhook
      // edge stroke.
      label: "webhook",
      className:
        "border-[rgba(245,158,11,0.4)] bg-[rgba(245,158,11,0.1)] text-amber",
    },
  };
  const m = meta[type];
  return (
    <span
      className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${m.className}`}
    >
      {m.label}
    </span>
  );
}
