"use client";

/**
 * shadcn/ui `tabs` primitive — copied source from
 * https://ui.shadcn.com/docs/components/tabs and adjusted at copy-in
 * time to use our palette tokens (`bg-bg2`, `text-ink`,
 * `border-border2`, etc.) instead of shadcn's default
 * `bg-muted`/`text-muted-foreground`/etc., which aren't defined in
 * our Tailwind config.
 *
 * Behaviour, accessibility, and component shape are unchanged from
 * the canonical shadcn source. Only the className strings differ.
 *
 * Radix peer: @radix-ui/react-tabs.
 */

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-9 items-center justify-start gap-1 border-b border-border2 px-1",
      className
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "relative inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-ink3 transition-colors",
      "hover:text-ink2",
      "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink3",
      "disabled:pointer-events-none disabled:opacity-50",
      "data-[state=active]:text-ink",
      // Bottom-edge underline that extends 1px beyond the parent's
      // border-b so the active tab visually merges with the body
      // beneath. Hides itself unless the trigger is active.
      "after:absolute after:bottom-[-1px] after:left-2 after:right-2 after:h-px after:bg-transparent",
      "data-[state=active]:after:bg-ink",
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "flex-1 min-h-0 overflow-y-auto",
      "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink3",
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
