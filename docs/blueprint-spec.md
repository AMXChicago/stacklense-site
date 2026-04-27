# Blueprint Dashboard — Implementation Spec

A live, connected blueprint of a software project. Shows platforms, services, and connections — kept current via the existing live introspection layer. This document specifies the **dashboard layer only**. The introspection/sync layer is upstream and out of scope here.

---

## Product positioning (drives every decision)

**"No matter how you connect it, the blueprint is available."** Live introspection (existing), git-watched (next), CLI (after), Claude Code-integrated (later). This dashboard renders whatever the upstream data layer provides — it does not care which source produced it.

Primary user wedge: **vibe coders who forget what their AI assistant built**. Every design choice should be evaluated against: *does this help someone re-orient themselves to a project they haven't touched in a week?*

---

## Data model

The model is **recursive**. A Service can contain Services. Do not model platforms and services as separate types — a Platform is just a Service with `kind: "platform"`. This avoids a rewrite when (not if) you add function-level, file-level, or module-level views.

```ts
type Service = {
  id: string;
  name: string;
  kind: "platform" | "service" | "function" | "module";
  parentId: string | null;          // null = top-level
  description?: string;
  status: "healthy" | "degraded" | "down" | "unknown";
  metadata: {
    file?: string;                  // e.g. src/handlers/createUser.ts
    lines?: number;
    brandColor?: string;            // for platforms
    [key: string]: any;
  };
  metrics: Metric[];                // see provider abstraction below
  lastChangedAt?: ISODate;
  createdAt: ISODate;
};

type Metric = {
  label: string;                    // "Req/day"
  value: string;                    // "47.2k" — pre-formatted, dashboard does not compute
  source: string;                   // which provider produced this
};

type Connection = {
  id: string;
  fromServiceId: string;
  toServiceId: string;
  type: "sync" | "async" | "webhook" | "event";
  what: string;                     // "Charge requests"
  schema?: string;                  // sample payload
  frequency?: string;               // "~340/day"
  latency?: string;                 // "180ms p99"
  lastChangedAt?: ISODate;
  createdAt: ISODate;
};

type Activity = {
  id: string;
  kind: "add" | "remove" | "change" | "deploy" | "config" | "edge";
  summary: string;                  // "added processRefund"
  detail: string;                   // longer prose
  affectedServiceIds: string[];     // for diff highlighting
  affectedConnectionIds: string[];
  timestamp: ISODate;
  source: string;                   // which integration produced this
};

type Project = {
  id: string;
  name: string;
  rootServiceIds: string[];         // top-level entries
  services: Record<string, Service>;
  connections: Record<string, Connection>;
  activity: Activity[];             // sorted desc by timestamp
};
```

### Multi-source conflicts
When live introspection, git, and CLI sources disagree about a service or connection, **the dashboard does not resolve this**. Resolution happens upstream and the dashboard receives the merged view. However, the dashboard should display the `source` field on metrics and activity items so users can see provenance.

### Metrics are pluggable
Do not hard-code metric fetching in the dashboard. Each Service declares which metrics it wants; a registered Provider per platform fetches them on a schedule. Dashboard renders whatever the model contains. Build the dashboard against fixture data first; add Providers one platform at a time.

---

## Layout

Single screen, no routing. Five regions:

```
┌──────────────────────────────────────────────────────────────┐
│ TOP BAR: project name · breadcrumb · live indicator · modes  │
├──────────────────────────────────────────────────────────────┤
│ PLATFORM ROW: chip per platform + search                     │
├─────────────┬────────────────────────────────────────────────┤
│             │                                                │
│  ACTIVITY   │              CANVAS                            │
│  SIDEBAR    │              (recursive drill-down)            │
│             │                                                │
│             │              [zoom controls]   [back]          │
├─────────────┴────────────────────────────────────────────────┤
│ INSPECTOR (full-width, swaps content based on selection)     │
└──────────────────────────────────────────────────────────────┘
```

### Region specs

- **Top bar** ~50px. Left: project name + multi-level breadcrumb (`Project › AWS › Lambda`) + live pulse indicator. Right: mode switcher (Architecture / Data Flow / Simulate).
- **Platform row** ~44px. Horizontal scrollable chips, one per top-level platform, plus an "All" reset chip and a search affordance. Search affordance (slash shortcut) is deferred — not in any numbered build step. Track separately.
- **Activity sidebar** ~200px wide, full body height. Always visible (collapse later if needed). Each item: relative time, kind dot, summary text. Hover preview, click to commit.
- **Canvas** flexible. Pan/zoom via React Flow or equivalent. Renders the current drill level. Background `--color-background-tertiary`.
- **Inspector** ~280px min height, full width. Single panel that swaps content based on what's selected (node, edge, function, activity item, or current mode state). The lower bound exists because the strip + tabs + first row of tab content need vertical room to breathe.

---

## Modes

All three modes render the **same graph**. Only interactions and inspector content differ.

### 1. Architecture (default)
- Click any node → inspector shows status, metrics, change timestamp, in/out connections.
- Click any edge → inspector shows from/to, type, what flows, schema, frequency, latency.
- Click any activity item → inspector shows the diff; affected nodes flash in canvas.
- Double-click a Platform group → drill in (see Drill-down below).

The node inspector's Connections tab uses the same edge roll-up rules as the canvas. The set of connections shown in the Connections tab equals the set of edges touching that node in the canvas at the current drill level — when a Platform-kind node is selected at top level, its Connections tab surfaces connections rolled up from descendants, matching what the canvas displays.

### 2. Data flow (trace)
- Click a destination node → animate path from User to that node.
- Off-path nodes dim to ~16% opacity. On-path nodes stay full opacity.
- Inspector shows the path as a horizontal arrow chain, plus the destination's payload schema.
- Hops + cumulative latency shown.

### 3. Simulate (user journey)
- Pre-defined Journey: ordered list of node IDs + step labels.
- Auto-plays on a timer (~1.5s/step). Visited nodes stay highlighted cumulatively.
- Inspector shows current step number, node name, and step label.
- Future: let users define and save journeys; v1 ships with one default.

---

## Interactions

### Drill-down (recursive)
Double-click a Service that contains other Services → enter that Service's interior. Children become first-class nodes; siblings disappear; breadcrumb extends.

```
Project
  └─ Project › AWS              (after dbl-clicking AWS group)
       └─ Project › AWS › Lambda  (after dbl-clicking Lambda)
            └─ Project › AWS › Lambda › processPayment   (future: line-level)
```

Implementation note: do **not** use separate routes or screens. Same canvas, different filtered view of the same recursive tree. Breadcrumb segments are clickable to climb out. `Esc` climbs one level. Back button in canvas corner climbs one level.

### Edge roll-up rules
- Connections crossing a drill boundary roll up to the nearest visible ancestor on each end.
- Deduplicate by `(fromId, toId, type)` tuple.
- Drop self-loops created by roll-up.
- This rule applies at every drill level.

### Activity → diff highlight
Clicking an activity item:
1. Marks the item as selected (left border accent).
2. Fetches the affected service IDs from the activity record.
3. For each affected node currently visible in the canvas, adds a `flash` class that animates opacity for ~3 seconds.
4. Inspector swaps to "Architectural diff" mode showing the change tag, summary, detail prose, and affected services.

If an affected service is not currently visible (e.g., it's a function inside a non-drilled Lambda), the flash is queued — when the user drills in, it fires.

### Edge interactions
Edges are first-class clickable objects. On click, edge gets a selection style (info color, 2px stroke); inspector switches to edge mode. Hover shows a tooltip with `from → to` only.

### Filtering
Platform chips use **dimming**, not hiding. Non-matching nodes drop to ~16% opacity. Preserves the user's mental map. Edges connecting two visible nodes stay visible; edges with one dimmed end inherit the dimmer opacity.

Multiple chips can be active at once. Clicking an active chip deselects it. The "All" chip clears all active filters.

### Keyboard
- `/` focus search
- `D` drill into the AWS group (or whichever platform is currently focused/hovered)
- `Esc` climb one drill level
- `1` `2` `3` switch modes

---

## Visual conventions

### Status dots (top-right corner of every node)
- Green `#1D9E75`: healthy
- Amber `#EF9F27`: degraded
- Red `#E24B4A`: down
- Gray: unknown

### Change indicator (top-left corner of node)
- Orange `#EF9F27` dot if `lastChangedAt` is within configurable window (default: 7 days).
- Optional small text label below the node showing relative time ("14m ago").

### Active-traffic halo
- Animated halo on nodes that are actively serving requests (req/s above threshold).
- Implemented as separate halo `<rect>` behind the node, animating opacity + stroke-width on a 2.6s loop.

### Edge styles
- Solid line: synchronous (HTTP, RPC, function call)
- Dashed line: asynchronous (queued, fire-and-forget, fan-out)
- Different marker or color: webhook (return path)

### Color rules
- Color encodes platform, not state. Each top-level Platform gets one ramp.
- Maximum 5 platform colors per visible canvas; if more, group lesser-used platforms under a neutral.
- State (healthy/degraded/changed/active) uses the small overlay indicators only — never recolors the node body.
- Non-platform services (e.g., User actor, external clients) render in neutral gray. They are exempt from platform filtering — always visible regardless of which platform chip is active.

---

## Tech stack

- **Canvas**: React Flow (handles pan, zoom, edge routing, minimap natively). Hand-rolled SVG works for the mockup but does not scale to real recursive drill-down or large graphs.
- **State**: Zustand. One store, single source of truth: current mode, selected node/edge, drill stack, filter state, current activity selection. Avoid prop-drilling.
- **Data fetching**: whatever the existing introspection layer provides. Dashboard subscribes to a normalized `Project` object via WebSocket or polling — it does not call AWS/Stripe/etc. directly.
- **Styling**: Tailwind or vanilla CSS variables. Match the existing app's design system; do not introduce a new component library here.
- **Animations**: CSS transitions/keyframes only for the canvas. No heavy animation libraries — performance matters with large graphs.

---

## Build order

Each step is shippable to yourself for dogfooding before moving on.

1. **Static recursive renderer** — accepts a `Project` JSON, renders the canvas at any drill level. No interactions yet beyond pan/zoom. Hardcode a fixture Project.
2. **Inspector + node click** — clicking a node populates a working inspector with name, status, metrics. Use fixture data.
3. **Platform filter chips + dimming.**
4. **Drill-down (one level)** — double-click platform → drill in. Breadcrumb works. Back button works.
5. **Drill-down (recursive)** — two levels deep (Lambda → functions). Verify the same renderer handles both.
6. **Edge inspector** — edges become clickable, edge inspector swaps in.
7. **Activity sidebar (read-only)** — render activity items from fixture.
8. **Activity → diff highlight** — clicking an item flashes affected nodes and shows diff inspector.
9. **Mode switcher** — wire up Architecture / Data Flow / Simulate. Trace mode walks a hardcoded path.
10. **Hook to live data** — replace fixture Project with the live data source you already have.
11. **Live indicators** — status dots, change timestamps, active halos driven by real metrics.
12. **Simulation editor** — let users define their own journeys (was hardcoded in step 9).

Do not skip steps. Each one is verifiable in isolation. When something breaks, you know which step introduced it.

---

## Anti-patterns (things to refuse)

- **Asking Claude Code to "build the whole dashboard."** Always scope to one numbered step above.
- **Using a separate route per drill level.** Recursive drill is one canvas, one state.
- **Hard-coding metric fetchers in the dashboard.** Metrics come from the model. Providers live elsewhere.
- **Recoloring nodes for state.** Color = platform. State = overlay indicators.
- **Hiding non-matching nodes when filtering.** Dim, don't hide. Preserves mental map.
- **Putting the activity feed in the bottom panel as a co-equal with the inspector.** It's the hero. Sidebar.
- **Creating a "diff view" route.** The diff is a state of the inspector, triggered by activity click.
- **Building edge interactions as a hover-only tooltip.** Edges are first-class clickable objects.

---

## Education layer (the wedge)

The dashboard is also a tutor. For vibe coders who don't already know what Lambda is or what a JWT does, the blueprint becomes the textbook — grounded in their actual project. This is the differentiator versus every other architecture diagramming tool.

### Source: LLM-on-demand
Every explainer is generated by an LLM when needed, never hand-written per platform. Pros: scales to any platform/service the user adds, including obscure ones. Cons: cost per generation, latency, occasional bad output. The mitigations below are mandatory, not optional.

### Caching is non-negotiable
- **Cache key**: `hash(serviceId + serviceKind + parentPlatform + projectFingerprint + explainerType)`. The `projectFingerprint` rolls up high-level project context (other services present, tech stack signals) so an explainer of "Lambda in a React/Postgres project" differs from "Lambda in a Next.js/DynamoDB project" — but only when context actually changes.
- **Invalidation**: only when the cache key changes. Adding a new function to Lambda doesn't invalidate Lambda's "what is this" explainer; changing the project's overall stack does.
- **Storage**: per-project key-value store. Explainers are not user-private; teammates on the same project see the same cached output.
- **TTL**: 90 days as a safety net for prompt drift; otherwise indefinite.
- **Manual regenerate**: every explainer in the UI has a "↻ regenerate" affordance. Cheap escape hatch when cached output is wrong.

### What gets explained (priority order)
1. **Services** — "what is this" + "why it's here" with alternatives and switch costs
2. **Edges** — "what flows over this connection," in plain language, not just schema
3. **Activity items** — "what this means for your app" + "heads up" warnings
4. **Functions** (when drilled in) — what each function does and why it exists
5. **Project overview** — the empty state, regenerated when the project shape changes meaningfully

### Glossary system (separate, not LLM-generated)
Technical jargon (`p99`, `cold start`, `JWT`, `MAU`, `webhook`, `MFA`, etc.) gets dotted underlines wherever it appears. Hover for a one-sentence plain-English explanation. The glossary is a hand-maintained dictionary, not LLM-generated — it needs to be consistent across the product and across users.

Wrap text-rendering of any explainer/inspector content through a `wrapJargon()` helper that finds glossary terms and inserts the underlined spans. This applies to metric labels, edge schema text, activity strings — everywhere text appears in the inspector.

### UI placement strategy (inline-everywhere)
Explainers live in the default Inspector view as the **first tab**, by design. A vibe coder shouldn't have to switch into a special mode to learn — the explanation is the primary content.

- Node inspector: tabs are `Explain | Metrics | Connections`. Default tab: Explain.
- Edge inspector: tabs are `Explain | Schema | Stats`. Default tab: Explain.
- Activity item: no tabs; "what this means" + "heads up" inlined directly.
- Empty state: project overview as a generated paragraph, no tabs.

### Streaming and loading
LLM responses are slow. Render the metadata strip immediately, show a "✨ Asking Claude..." placeholder for ~400ms, then stream the response token-by-token. Never block the entire panel waiting for a complete response.

### Cost guardrails
- Pre-warm the cache for top-N most-likely-clicked services (Lambda, central DB, payment provider) at project sync time.
- Rate-limit regenerate to once per minute per user per service.
- Show a small token count in the meta row so cost-conscious users see what's happening.

---

## Inspector v4 (split layout)

Earlier iterations had a single inspector that swapped content based on selection. v4 splits this into three regions:

```
┌──────────────────────────────────────────────────────────┐
│ STRIP: name + tags + status + last changed  [clear]      │  always visible
├──────────────────────────────────────────────────────────┤
│ TABS: context-appropriate                                │  context-dependent
├──────────────────────────────────────────────────────────┤
│ TAB BODY: only the active tab's content                  │  scrollable
└──────────────────────────────────────────────────────────┘
```

Strip is always visible — user always knows what's selected. Tabs vary by selection type (no tabs for activity items or trace results). Tab body is scrollable so explainers can be long without breaking the layout.

---

## Onboarding / empty state

When nothing is selected, the inspector shows a project overview paragraph (LLM-generated, regenerated when the project shape changes meaningfully) plus a small set of "try this first" actions that select specific services or activity items.

This is shown:
- On first load
- After clicking "clear" on the strip
- After deselection (clicking the canvas background)

Never show a blank panel with "click anything to inspect" — that's a wasted first impression.

---

## Future education modes (roadmap)

The inline-everywhere approach above ships first. These come after, in order of importance:

### 1. Project tour (guided walkthrough)
First-time-user flow that introduces the project piece by piece. Highlights one node at a time, plays the explainer, suggests the next step. Can be re-triggered from a help menu. ~30-60 seconds end to end. This is the single highest-leverage education feature for true vibe coders — they don't know what to click without it.

### 2. Companion panel (persistent tutor)
A right-side collapsible panel that explains whatever you've selected, with progressive depth (one-paragraph summary → full doc → related concepts). Effectively a chat panel scoped to the current selection. Lets users ask follow-up questions like "what would happen if I removed this?"

### 3. Learn mode (4th mode tab)
Adds `Learn` next to `Architecture / Data Flow / Simulate`. In Learn mode the canvas is annotated with floating callouts, edges have inline labels, and clicking anywhere triggers a teaching flow rather than a pure inspector. Best for users actively trying to understand the project end-to-end.

### 4. Mode switcher rename for vibe coders
"Architecture / Data Flow / Simulate" assumes vocabulary. Add a setting (or a one-time toggle on first run) that renames them to "Map / Trace / Replay" with descriptive tooltips. Gate behind a "I'm new to this" toggle in the project's settings, default on for new accounts.

---

## Additional anti-patterns (v4)

- **Blocking the UI on an LLM call.** Strip and tab structure must render instantly with cached/static data; explainer streams in after.
- **Regenerating explainers on every view.** This will burn money. Cache aggressively per the strategy above.
- **Putting explainers behind a "Learn" mode in v1.** They live in the default view. Learn mode is later, and additive.
- **Hand-writing explainers per platform "for quality."** You will not keep up. The LLM-on-demand approach with glossary fallback is the scaling path.
- **Skipping the glossary tooltip system because explainers exist.** Glossary covers terms that appear *outside* explainers (in metric labels, edge schemas, activity strings) where you can't rewrite them in plain language.
- **Letting the project overview empty state become "click anything to inspect."** Always populate it with the LLM-generated overview.

---

## Updated build order (v4 additions)

After the v3 build steps (1-12), continue:

13. **Glossary tooltip system** — hand-maintained dictionary + `wrapJargon()` text helper + tooltip popover. Wire it into all rendered text in inspector and metric labels. Ship before any LLM work — useful immediately.
14. **Inspector v4 split** — refactor the inspector into strip + tabs + tabbody. All existing inspector states (node, edge, activity, trace, sim) continue to work, just rendered through the new structure.
15. **Static explainer fixtures** — hard-code 5-10 service explainers, 5-10 edge explainers, 5 activity expansions. Render with the streaming UI. Verify the layout holds up before paying for any LLM tokens.
16. **LLM provider + cache** — call your LLM with `(service, context) → explainer` prompt. Cache by fingerprint per the strategy above. Replace fixtures one type at a time.
17. **Project overview empty state** — generated on project sync, cached, refreshed when shape changes. Replace any "click anything to inspect" placeholder.
18. **Pre-warm + rate limits** — populate cache for likely-clicked services at sync time. Rate-limit regenerate.

After 18, you have shipped the inline-everywhere education layer.

Then circle back to the future education modes (Project tour first, then Companion panel, then Learn mode, then mode switcher rename).

---

## Open questions for later

These do not block v1 but will need answers:

1. How are user-defined Journeys persisted? (Per-project file? Cloud sync?)
2. What does "line-level" drill-down inside a function look like? (Probably a code preview pane, not a graph.)
3. How does multi-environment work — staging vs production blueprints side-by-side?
4. Comments/annotations on nodes for team collaboration?
5. Diff between two points in time (architecture as of last Monday vs now)?

Park these. Do not let them creep into v1.
