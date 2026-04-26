"use client";

import { useState } from "react";
import { vendorInitial, vendorLogoUrl } from "@/lib/vendor-logos";

/**
 * Renders a vendor logo from Clearbit if we can resolve a domain for the
 * vendor name. Falls back to a colored letter avatar for unknown vendors
 * or when Clearbit returns 404.
 */
export function VendorLogo({
  vendor,
  size = 32,
}: {
  vendor: string | undefined | null;
  size?: number;
}) {
  const url = vendorLogoUrl(vendor);
  const [failed, setFailed] = useState(false);

  if (!url || failed) {
    return (
      <div
        className="vendor-fallback"
        style={{ width: size, height: size, fontSize: size * 0.45 }}
      >
        {vendorInitial(vendor)}
      </div>
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={url}
      alt=""
      width={size}
      height={size}
      className="vendor-logo"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
