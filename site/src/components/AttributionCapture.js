"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { captureAttribution } from "@/lib/attribution";

// Records campaign parameters on arrival, and tells the Meta Pixel about
// in-app page changes (GA4 and LinkedIn pick those up on their own).
export default function AttributionCapture({ metaPixel = false }) {
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    captureAttribution();
    if (first.current) {
      first.current = false;
      return;
    }
    if (metaPixel && typeof window.fbq === "function") window.fbq("track", "PageView");
  }, [pathname, metaPixel]);

  return null;
}
