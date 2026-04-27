import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind utility classes safely.
 *
 * Combines clsx (conditional class composition) with tailwind-merge
 * (deduplicates conflicting Tailwind utilities — e.g., `px-2 px-4`
 * collapses to `px-4`). Required by every shadcn/ui primitive copied
 * into components/ui/.
 *
 * Usage:
 *   <div className={cn("px-4 py-2", isActive && "bg-green", className)} />
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
