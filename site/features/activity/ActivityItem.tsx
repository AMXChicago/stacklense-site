"use client";

/**
 * ActivityItem — one row in the activity sidebar.
 *
 * Shape (per spec layout / region specs / Activity sidebar):
 *   relative time · kind dot · summary text
 *
 * Summary supports a tiny markdown subset:
 *   **bold**   — service / platform names (rendered as <strong>)
 *   `code`     — versions, columns, function names (rendered <code>)
 *
 * Step 7 ships read-only — no click handler, no selection wiring.
 * Hover affordance lives on the row so users get a "this will be
 * interactive later" hint, but clicks don't do anything yet.
 * Step 8 wires up the activity click → diff highlight flow.
 */

import type { Activity, ActivityKind } from "@/lib/types";
import { relativeTime } from "@/features/inspector/lib/relative-time";

/**
 * Per-kind dot colour. Spec doesn't lock these — choices below
 * follow the existing palette (greens for "good change",
 * red for removal, amber for attention, ink2 neutral for info).
 *
 * `add` and `deploy` share the same green because both are
 * forward-positive. Distinct icons would help disambiguate but
 * step 7 keeps it to a single dot per spec — icons can be a
 * v2 polish pass.
 */
const KIND_DOT_COLOR: Record<ActivityKind, string> = {
  add: "var(--green)",
  remove: "var(--red)",
  change: "var(--amber)",
  deploy: "var(--green)",
  config: "var(--amber)",
  edge: "var(--ink2)",
};

const KIND_ARIA_LABEL: Record<ActivityKind, string> = {
  add: "added",
  remove: "removed",
  change: "changed",
  deploy: "deployed",
  config: "configured",
  edge: "edge detected",
};

export default function ActivityItem({ activity }: { activity: Activity }) {
  const time = relativeTime(activity.timestamp) ?? "—";
  const dotColor = KIND_DOT_COLOR[activity.kind];

  return (
    <li
      // hover affordance only — clicks are wired in step 8.
      className="group flex gap-2.5 border-l-2 border-transparent px-3 py-2.5 transition-colors hover:border-border2 hover:bg-bg2"
    >
      <div className="flex shrink-0 flex-col items-center pt-1">
        <span
          aria-label={KIND_ARIA_LABEL[activity.kind]}
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: dotColor }}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[10px] uppercase tracking-wider text-ink3">
          {time}
        </div>
        <p className="mt-0.5 text-[13px] leading-snug text-ink2">
          <FormattedSummary text={activity.summary} />
        </p>
      </div>
    </li>
  );
}

/**
 * Inline formatter for the activity summary string. Supports
 * **bold** and `code` only — no nesting, no escaping, no other
 * markdown. The fixture is hand-written so we don't have to
 * worry about adversarial input.
 *
 * Implementation: split on each delimiter alternately. We do TWO
 * regex passes (one for `code`, one for `**bold**`) so the user
 * doesn't have to think about escape interactions.
 */
function FormattedSummary({ text }: { text: string }) {
  // First pass: split on `code` segments.
  const codeSplit = text.split(/(`[^`]+`)/g);
  const out: React.ReactNode[] = [];
  codeSplit.forEach((piece, idx) => {
    if (piece.startsWith("`") && piece.endsWith("`")) {
      out.push(
        <code
          key={`c-${idx}`}
          className="rounded bg-bg3 px-1 py-0.5 font-mono text-[11px] text-ink"
        >
          {piece.slice(1, -1)}
        </code>
      );
      return;
    }
    // Second pass on non-code pieces: split on **bold**.
    const boldSplit = piece.split(/(\*\*[^*]+\*\*)/g);
    boldSplit.forEach((sub, jdx) => {
      if (sub.startsWith("**") && sub.endsWith("**")) {
        out.push(
          <strong key={`b-${idx}-${jdx}`} className="font-semibold text-ink">
            {sub.slice(2, -2)}
          </strong>
        );
      } else if (sub) {
        out.push(<span key={`t-${idx}-${jdx}`}>{sub}</span>);
      }
    });
  });
  return <>{out}</>;
}
