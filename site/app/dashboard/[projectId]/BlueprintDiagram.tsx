"use client";

/**
 * Blueprint flow diagram — non-technical-first redesign.
 *
 * The previous version was a 4×3 grid of categories. That worked as an
 * atlas, but it didn't communicate FLOW: a vibe-coder founder couldn't
 * look at it and trace "where my code starts → where it runs → where
 * data lives → how users reach it".
 *
 * The new layout arranges the same 12 categories into 5 numbered
 * lifecycle stages, top-to-bottom:
 *
 *   1. Build  — where code is made & shipped (AI tools, repo, deploys)
 *   2. Run    — where the app actually executes (framework, hosting)
 *   3. Store  — where data & credentials live (DBs, secrets)
 *   4. Reach  — how users find and use the app (DNS, login, comms,
 *               payments)
 *   5. Watch  — how you spot and fix problems (logs, monitoring)
 *
 * Each stage has a plain-English subtitle. Each category inside a stage
 * has a plain-English subtitle. Component cards keep the vendor logo +
 * deep-link to the vendor's console. Visual ↓ arrows between stages
 * make the flow direction obvious without requiring AWS/Vercel jargon.
 *
 * We dropped React Flow for this view because lanes don't benefit from
 * pan/zoom and the package's layout primitives fight the lane shape.
 * The dependency is still installed in case we bring RF back elsewhere.
 */

import { Fragment } from "react";
import { VendorLogo } from "./VendorLogo";

export type DiagramComponent = {
  id: string;
  name: string;
  vendor?: string;
  description: string;
  evidence?: string;
  console_url?: string;
};

export type DiagramCategory = {
  key: string;
  label: string;
  components: DiagramComponent[];
};

export type DiagramConnection = {
  from: string;
  to: string;
  label?: string;
};

/**
 * The 5 lifecycle stages, in flow order. Each has a brand colour used
 * for the stage number badge, the left-edge accent, and the link
 * between stages.
 */
const LANES: Array<{
  key: string;
  number: string;
  title: string;
  subtitle: string;
  color: string;
}> = [
  {
    key: "build",
    number: "1",
    title: "Build",
    subtitle: "Where your code is made and shipped",
    color: "#a855f7",
  },
  {
    key: "run",
    number: "2",
    title: "Run",
    subtitle: "Where your app actually executes",
    color: "#3dd68c",
  },
  {
    key: "store",
    number: "3",
    title: "Store",
    subtitle: "Where your data and credentials live",
    color: "#3b82f6",
  },
  {
    key: "reach",
    number: "4",
    title: "Reach",
    subtitle: "How users find and use your app",
    color: "#ec4899",
  },
  {
    key: "watch",
    number: "5",
    title: "Watch",
    subtitle: "How you spot and fix problems",
    color: "#06b6d4",
  },
];

const CATEGORY_TO_LANE: Record<string, string> = {
  ai_dev_tools: "build",
  source_control: "build",
  ci_cd: "build",
  application_stack: "run",
  hosting_compute: "run",
  data_storage: "store",
  security_secrets: "store",
  authentication: "reach",
  domains_dns: "reach",
  communications: "reach",
  payments: "reach",
  observability: "watch",
};

/**
 * Plain-English titles and one-line explanations for each category.
 * The technical name (e.g. "AI & dev tools") is preserved for
 * developer reference but de-emphasised; the customer-facing title and
 * subtitle do the work.
 */
const CATEGORY_FRIENDLY: Record<
  string,
  { title: string; subtitle: string }
> = {
  ai_dev_tools: {
    title: "AI helpers",
    subtitle: "Tools you use to write the code (Claude, Cursor, Copilot).",
  },
  source_control: {
    title: "Code repository",
    subtitle: "Where your code is stored online.",
  },
  ci_cd: {
    title: "Deployment pipeline",
    subtitle: "How code goes from your laptop to live for users.",
  },
  application_stack: {
    title: "App framework",
    subtitle: "The languages and frameworks your app is built with.",
  },
  hosting_compute: {
    title: "Where it runs",
    subtitle: "The servers that keep your app online.",
  },
  data_storage: {
    title: "Data & files",
    subtitle: "Databases, file storage, and caches that hold your app's data.",
  },
  security_secrets: {
    title: "Secrets & certificates",
    subtitle: "API keys, passwords, and SSL — the credentials that keep your app safe.",
  },
  authentication: {
    title: "User login",
    subtitle: "How people sign in to use your app.",
  },
  domains_dns: {
    title: "Web addresses",
    subtitle: "Your URLs and the system that points them to your app.",
  },
  communications: {
    title: "Email & messaging",
    subtitle: "How your app talks to users — emails, texts, push notifications.",
  },
  payments: {
    title: "Payments",
    subtitle: "How your app accepts money from customers.",
  },
  observability: {
    title: "Logs & alerts",
    subtitle: "How you spot problems before users complain.",
  },
};

export function BlueprintDiagram({
  categories,
}: {
  categories: DiagramCategory[];
  // connections is no longer rendered — flow direction is communicated
  // by the lane order. The prop is kept for backward compat with callers.
  connections?: DiagramConnection[];
}) {
  // Group categories by lane, preserving lane order.
  const lanesWithCategories = LANES.map((lane) => ({
    ...lane,
    categories: categories.filter(
      (c) => CATEGORY_TO_LANE[c.key] === lane.key
    ),
  }));

  const hasAnyComponent = categories.some((c) => c.components.length > 0);

  if (!hasAnyComponent) {
    return (
      <div className="project-empty">
        <p>
          The lens scanned your project but didn&rsquo;t detect any
          components yet. Try regenerating, or connect a richer source
          (GitHub repo) for more to analyse.
        </p>
      </div>
    );
  }

  return (
    <div className="bp-flow">
      <ReadingGuide />
      <ol className="bp-flow-lanes">
        {lanesWithCategories.map((lane, idx) => (
          <Fragment key={lane.key}>
            <Lane lane={lane} />
            {idx < lanesWithCategories.length - 1 && (
              <FlowArrow color={lane.color} nextColor={LANES[idx + 1].color} />
            )}
          </Fragment>
        ))}
      </ol>
    </div>
  );
}

function ReadingGuide() {
  return (
    <div className="bp-flow-guide">
      <p>
        Read this top to bottom — it&rsquo;s the journey your app takes,
        from the moment you write code to the moment a user clicks
        around. Each numbered stage groups the parts that play the same
        role. Click any tile to open it in the vendor&rsquo;s console.
      </p>
    </div>
  );
}

function Lane({
  lane,
}: {
  lane: (typeof LANES)[number] & { categories: DiagramCategory[] };
}) {
  return (
    <li
      className="bp-flow-lane"
      style={{ ["--lane-color" as string]: lane.color }}
    >
      <header className="bp-flow-lane-header">
        <span className="bp-flow-lane-num" aria-hidden>
          {lane.number}
        </span>
        <div className="bp-flow-lane-text">
          <h3 className="bp-flow-lane-title">{lane.title}</h3>
          <p className="bp-flow-lane-subtitle">{lane.subtitle}</p>
        </div>
      </header>
      <div className="bp-flow-lane-body">
        {lane.categories.map((cat) => (
          <CategoryBlock key={cat.key} category={cat} />
        ))}
      </div>
    </li>
  );
}

function CategoryBlock({ category }: { category: DiagramCategory }) {
  const friendly =
    CATEGORY_FRIENDLY[category.key] ?? {
      title: category.label,
      subtitle: "",
    };
  const isEmpty = category.components.length === 0;
  return (
    <div className={`bp-flow-cat ${isEmpty ? "bp-flow-cat-empty" : ""}`}>
      <div className="bp-flow-cat-header">
        <h4 className="bp-flow-cat-title">{friendly.title}</h4>
        {friendly.subtitle && (
          <p className="bp-flow-cat-subtitle">{friendly.subtitle}</p>
        )}
      </div>
      {isEmpty ? (
        <div className="bp-flow-cat-not-detected">
          <span className="bp-flow-cat-not-detected-dot" aria-hidden />
          Not detected — either you don&rsquo;t use this, or our scan
          didn&rsquo;t spot it.
        </div>
      ) : (
        <div className="bp-flow-components">
          {category.components.map((c) => (
            <ComponentCard key={c.id} component={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function ComponentCard({ component }: { component: DiagramComponent }) {
  const inner = (
    <>
      <VendorLogo
        vendor={component.vendor ?? component.name}
        size={32}
      />
      <div className="bp-flow-comp-text">
        <div className="bp-flow-comp-name">{component.name}</div>
        {component.vendor && component.vendor !== component.name && (
          <div className="bp-flow-comp-vendor">{component.vendor}</div>
        )}
      </div>
      {component.console_url && (
        <span className="bp-flow-comp-arrow" aria-hidden>
          ↗
        </span>
      )}
    </>
  );
  const cardBody = (
    <>
      <div className="bp-flow-comp-head">{inner}</div>
      {component.description && (
        <p className="bp-flow-comp-desc">{component.description}</p>
      )}
    </>
  );
  return component.console_url ? (
    <a
      href={component.console_url}
      target="_blank"
      rel="noopener noreferrer"
      className="bp-flow-comp bp-flow-comp-link"
      title={`Open ${component.name} in vendor console`}
    >
      {cardBody}
    </a>
  ) : (
    <div className="bp-flow-comp">{cardBody}</div>
  );
}

function FlowArrow({
  color,
  nextColor,
}: {
  color: string;
  nextColor: string;
}) {
  return (
    <li
      className="bp-flow-arrow"
      aria-hidden
      style={{
        ["--arrow-from" as string]: color,
        ["--arrow-to" as string]: nextColor,
      }}
    >
      <svg viewBox="0 0 24 56" width="24" height="56">
        <defs>
          <linearGradient id={`g-${color}-${nextColor}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.7" />
            <stop offset="100%" stopColor={nextColor} stopOpacity="0.7" />
          </linearGradient>
        </defs>
        <line
          x1="12"
          y1="0"
          x2="12"
          y2="44"
          stroke={`url(#g-${color}-${nextColor})`}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <polyline
          points="6,42 12,54 18,42"
          fill="none"
          stroke={nextColor}
          strokeOpacity="0.85"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </li>
  );
}
