"use client";

/**
 * Edge-inspector tabs. Per spec UI placement strategy:
 *
 *   Edge inspector: tabs are `Explain | Schema | Stats`.
 *   Default tab: Explain.
 *
 * Same v4 split structure as the node inspector — strip is rendered
 * by the parent (EdgeInspector); this component owns the tab
 * picker + bodies. Local tab state (not store-persisted) for the
 * same reasons as NodeInspectorTabs.
 */

import { useState } from "react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

import type { Connection, Project } from "@/lib/types";
import EdgeExplainTab from "./tabs/EdgeExplainTab";
import SchemaTab from "./tabs/SchemaTab";
import StatsTab from "./tabs/StatsTab";

type TabKey = "explain" | "schema" | "stats";

export default function EdgeInspectorTabs({
  connection,
  project,
}: {
  connection: Connection;
  project: Project;
}) {
  const [tab, setTab] = useState<TabKey>("explain");
  const hasSchema = !!connection.schema;
  const statsCount =
    (connection.frequency ? 1 : 0) + (connection.latency ? 1 : 0);

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => setTab(v as TabKey)}
      className="flex h-full min-h-0 flex-col"
    >
      <TabsList className="px-3">
        <TabsTrigger value="explain">Explain</TabsTrigger>
        <TabsTrigger value="schema">
          Schema
          {hasSchema && (
            <span
              className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-ink3"
              aria-hidden
            />
          )}
        </TabsTrigger>
        <TabsTrigger value="stats">
          Stats
          {statsCount > 0 && (
            <span className="ml-1.5 font-mono text-[10px] text-ink3">
              {statsCount}
            </span>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="explain">
        <EdgeExplainTab connection={connection} project={project} />
      </TabsContent>
      <TabsContent value="schema">
        <SchemaTab connection={connection} />
      </TabsContent>
      <TabsContent value="stats">
        <StatsTab connection={connection} />
      </TabsContent>
    </Tabs>
  );
}
