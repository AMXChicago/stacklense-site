"use client";

/**
 * Tiny "click to copy to clipboard" button. Used for things like the CFN
 * template URL that the customer needs to paste into the AWS Console
 * Update wizard (AWS doesn't expose a URL pattern that pre-fills the
 * update form, so we hand them the value to paste).
 */

import { useState } from "react";

export function CopyButton({
  value,
  label = "Copy",
  copiedLabel = "Copied!",
  className,
}: {
  value: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function onClick() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Older browsers / non-secure context. Fall back to a hidden textarea.
      const ta = document.createElement("textarea");
      ta.value = value;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      } catch {
        // Give up — user can manually select.
      } finally {
        document.body.removeChild(ta);
      }
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={className ?? "copy-btn"}
      aria-label={label}
    >
      {copied ? copiedLabel : label}
    </button>
  );
}
