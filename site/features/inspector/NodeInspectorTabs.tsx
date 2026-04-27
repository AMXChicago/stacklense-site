"use client";

/**
 * Node-inspector tabs. Per spec UI placement strategy:
 *
 *   Node inspector: tabs are `Explain | Metrics | Connections`.
 *   Default tab: Explain.
 *
 * Wired through the shadcn Tabs primitive (components/ui/tabs.tsx).
 * The `value` is local component state — there's no spec or product
 * requirement that the active tab persist across selections, and
 * keeping it local means the workspace store doesn't have to track
 * a per-selection tab choice. If we ever want "remember last tab
 * for THIS service," that's a small addition later.
 */

import { useState } from "react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

import type { Project, Service } from "@/lib/types";
import { useWorkspaceStore } from "@/store/workspace-store";
import { connectionsForSelected } from "./lib/connections-for";
import ConnectionsTab from "./tabs/ConnectionsTab";
import ExplainTab from "./tabs/ExplainTab";
import MetricsTab from "./tabs/MetricsTab";

type TabKey = "explain" | "metrics" | "connections";

export default function NodeInspectorTabs({
  service,
  project,
}: {
  service: Service;
  project: Project;
}) {
  const [tab, setTab] = useState<TabKey>("explain");
  const drillStack = useWorkspaceStore((s) => s.drillStack);

  // Compute connection lists once per render — cheap relative to
  // the canvas re-layout that's already happening on selection
  // changes, and it depends on three values we have inline.
  const { outgoing, incoming } = connectionsForSelected(
    project,
    service.id,
    drillStack
  );

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => setTab(v as TabKey)}
      className="flex h-full min-h-0 flex-col"
    >
      <TabsList className="px-3">
        <TabsTrigger value="explain">Explain</TabsTrigger>
        <TabsTrigger value="metrics">
          Metrics
          {service.metrics.length > 0 && (
            <span className="ml-1.5 font-mono text-[10px] text-ink3">
              {service.metrics.length}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="connections">
          Connections
          {outgoing.length + incoming.length > 0 && (
            <span className="ml-1.5 font-mono text-[10px] text-ink3">
              {outgoing.length + incoming.length}
            </span>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="explain">
        <ExplainTab service={service} />
      </TabsContent>
      <TabsContent value="metrics">
        <MetricsTab service={service} />
      </TabsContent>
      <TabsContent value="connections">
        <ConnectionsTab
          service={service}
          outgoing={outgoing}
          incoming={incoming}
        />
      </TabsContent>
    </Tabs>
  );
}
