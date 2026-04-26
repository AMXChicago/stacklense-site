"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Re-fetches the current server-rendered page on an interval. Only mounted
 * when the project is in a transient state (generating). When the parent
 * stops rendering this (status moves to ready/failed), the interval clears.
 *
 * Uses router.refresh() rather than window.location.reload() so the user
 * keeps scroll position, form state, etc.
 */
export function AutoRefresh({ intervalMs = 3000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, router]);
  return null;
}
