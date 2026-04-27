/**
 * Glossary system — hand-maintained dictionary + wrapJargon helper.
 *
 * Per spec "Glossary system": this is NOT LLM-generated. It's a
 * deliberately hand-curated dictionary of technical terms with one-
 * sentence plain-English explanations, used everywhere text appears
 * in the dashboard (metric labels, edge schema text, activity
 * strings, explainer prose). Consistent across users and across
 * pages.
 *
 * The wiring (tooltip popover, dotted underline, click handlers)
 * lives in features/glossary/. This file is data only.
 *
 * Term keys are lowercased and matched whole-word case-insensitively
 * by features/glossary's wrapJargon helper. Definitions should be:
 *   - One sentence
 *   - No further jargon (or it gets nested tooltips)
 *   - Plain English a vibe coder understands
 */

export type GlossaryEntry = {
  term: string;
  definition: string;
};

/**
 * STUB. Populated as the dashboard surfaces terms. Spec build step 13
 * fills in the initial dictionary and ships the tooltip wiring.
 */
export const GLOSSARY: ReadonlyArray<GlossaryEntry> = [];

/**
 * Look up a term, case-insensitive. Returns undefined if not in the
 * dictionary — callers should fall back to rendering plain text.
 */
export function lookupJargon(term: string): GlossaryEntry | undefined {
  const needle = term.trim().toLowerCase();
  return GLOSSARY.find((e) => e.term.toLowerCase() === needle);
}
