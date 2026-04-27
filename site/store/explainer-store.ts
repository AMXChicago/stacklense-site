/**
 * Explainer cache — in-memory mirror of the explainer cache.
 *
 * Per spec "Caching is non-negotiable": the source of truth is a
 * per-project key-value store (Supabase). This Zustand store is an
 * in-memory mirror used by features/explainer to avoid round-trips
 * during a session. On first access of a cache key, the explainer
 * feature reads from the persistent store and populates here.
 *
 * Cache key shape (spec):
 *   hash(serviceId + serviceKind + parentPlatform + projectFingerprint
 *        + explainerType)
 *
 * STUB. Expanded in spec build step 16 (LLM provider + cache).
 */

import { create } from "zustand";

export type ExplainerEntry = {
  text: string;
  generatedAt: string;
  tokens?: number;
};

export type ExplainerState = {
  cache: Record<string, ExplainerEntry>;
  set: (key: string, entry: ExplainerEntry) => void;
  invalidate: (key: string) => void;
  clear: () => void;
};

export const useExplainerStore = create<ExplainerState>((set) => ({
  cache: {},
  set: (key, entry) =>
    set((s) => ({ cache: { ...s.cache, [key]: entry } })),
  invalidate: (key) =>
    set((s) => {
      const next = { ...s.cache };
      delete next[key];
      return { cache: next };
    }),
  clear: () => set({ cache: {} }),
}));
