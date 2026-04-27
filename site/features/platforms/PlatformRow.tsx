"use client";

/**
 * PlatformRow — the horizontal scrollable strip of platform filter
 * chips that sits above the canvas.
 *
 * Per spec layout / region specs:
 *   "Platform row ~44px. Horizontal scrollable chips, one per
 *    top-level platform, plus an 'All' reset chip and a search
 *    affordance."
 *
 * Step 3 ships chips + the "All" reset. The search affordance is
 * deferred — the keyboard shortcut `/` and free-text search arrive
 * with the search step (not numbered yet in the build order; tracked
 * for a later pass).
 *
 * Filter behaviour (per spec interactions / filtering):
 *   "Platform chips use dimming, not hiding. Non-matching nodes
 *    drop to ~16% opacity."
 *
 * Click behaviour:
 *   - Click "All"           → clearFilter (set goes empty)
 *   - Click a platform chip → toggleFilter(platformId)
 *
 * Multi-select is supported because the workspace store models
 * `filter` as a Set. The user can light up Stripe AND Anthropic to
 * compare the two simultaneously. The "All" chip is shown as active
 * when the filter is empty (default state).
 *
 * Chip discovery:
 *   We only emit chips for top-level services with `kind: "platform"`.
 *   Non-platform top-level services (e.g. the User actor) intentionally
 *   get NO chip — they are exempt from filtering per the color rules
 *   ("Non-platform services... always visible regardless of which
 *    platform chip is active").
 *
 *   Order is `project.rootServiceIds` — preserves whatever order the
 *   project adapter (or fixture author) chose. Stable, predictable.
 */

import type { Project, Service } from "@/lib/types";
import { useWorkspaceStore } from "@/store/workspace-store";

// Same fallback palette as useCanvasNodes so a chip's brand dot
// matches the node's left-border colour. Step 10 (project adapter)
// will populate Service.metadata.brandColor for real platforms; this
// map stays as the fallback for ids without that metadata.
const PLATFORM_COLOR_FALLBACK: Record<string, string> = {
  aws: "#ff9900",
  stripe: "#635bff",
  anthropic: "#d97757",
};
const NEUTRAL = "#5a5a54";

function brandColorFor(service: Service): string {
  const fromMetadata =
    typeof service.metadata.brandColor === "string"
      ? service.metadata.brandColor
      : null;
  return fromMetadata ?? PLATFORM_COLOR_FALLBACK[service.id] ?? NEUTRAL;
}

export default function PlatformRow({ project }: { project: Project }) {
  const filter = useWorkspaceStore((s) => s.filter);
  const toggleFilter = useWorkspaceStore((s) => s.toggleFilter);
  const clearFilter = useWorkspaceStore((s) => s.clearFilter);

  // Discover chip-eligible platforms: top-level entries that are
  // `kind: "platform"`. Done inline (cheap; rootServiceIds is small)
  // — no need for a hook or memo until the project gets large.
  const platforms: Service[] = project.rootServiceIds
    .map((id) => project.services[id])
    .filter((s): s is Service => !!s && s.kind === "platform");

  const allActive = filter.size === 0;

  return (
    <div
      // 44px row height per spec; horizontal scroll if chips overflow.
      // Border-bottom ties it visually to the canvas below.
      className="flex h-11 min-h-[44px] items-center gap-2 overflow-x-auto border-b border-border bg-bg px-3"
      role="toolbar"
      aria-label="Platform filter"
    >
      <ChipButton
        label="All"
        // The "All" chip is active when no platforms are filtered.
        // Clicking it clears the filter unconditionally — even when
        // already active it's a harmless no-op (set was already
        // empty), so we don't bother short-circuiting.
        active={allActive}
        onClick={clearFilter}
      />

      {platforms.map((p) => (
        <ChipButton
          key={p.id}
          label={p.name}
          dotColor={brandColorFor(p)}
          active={filter.has(p.id)}
          onClick={() => toggleFilter(p.id)}
        />
      ))}
    </div>
  );
}

/**
 * Chip primitive. Kept as a local component because every chip in
 * the row shares the same shape; promoting it to features/ui or
 * shadcn would be over-abstracting for one usage site.
 *
 * Tailwind tokens map to the existing palette (bg2, ink, ink2,
 * border2). No new component library, no new shadcn primitives.
 */
function ChipButton({
  label,
  dotColor,
  active,
  onClick,
}: {
  label: string;
  dotColor?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        "flex shrink-0 items-center gap-2 rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors",
        active
          ? "border-ink bg-bg3 text-ink"
          : "border-border2 bg-bg2 text-ink2 hover:text-ink",
      ].join(" ")}
    >
      {dotColor && (
        <span
          aria-hidden="true"
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: dotColor }}
        />
      )}
      {label}
    </button>
  );
}
