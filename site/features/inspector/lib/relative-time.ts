/**
 * Format an ISO timestamp as a short relative-time string ("3d ago",
 * "14m ago", "just now"). Used by the inspector's metadata strip to
 * render `lastChangedAt` compactly.
 *
 * Returns null when the timestamp is missing or in the future. The
 * caller decides what to do with null (typically: omit the field).
 *
 * Per spec, the strip's "last changed" cell is one of the strip's
 * static metadata items — short and stable. No "1 minute ago" prose;
 * abbreviated units only.
 */

const MIN = 60;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

export function relativeTime(iso: string | undefined): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const seconds = Math.floor((Date.now() - then) / 1000);
  if (seconds < 0) return null;
  if (seconds < 45) return "just now";
  if (seconds < MIN * 2) return "1m ago";
  if (seconds < HOUR) return `${Math.floor(seconds / MIN)}m ago`;
  if (seconds < HOUR * 2) return "1h ago";
  if (seconds < DAY) return `${Math.floor(seconds / HOUR)}h ago`;
  if (seconds < DAY * 2) return "1d ago";
  if (seconds < WEEK) return `${Math.floor(seconds / DAY)}d ago`;
  if (seconds < MONTH) return `${Math.floor(seconds / WEEK)}w ago`;
  if (seconds < YEAR) return `${Math.floor(seconds / MONTH)}mo ago`;
  return `${Math.floor(seconds / YEAR)}y ago`;
}
