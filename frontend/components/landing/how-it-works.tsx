"use client";

import Timeline from "@/components/ui/timeline";
import logoBg from "@/assets/logo/logobg.png";

/**
 * How-it-works section: horizontal scroll timeline of TrustVault's access path.
 * Keeps #how-it-works for nav anchors; colours match the black / teal landing.
 * Image is local (CSP img-src 'self') — no third-party CDNs.
 */
export function HowItWorksSection() {
  return (
    <Timeline
      title="How it works"
      periodLabel="Upload → grant → prove"
      backgroundColor="#000000"
      textColor="#ededed"
      mutedTextColor="#a3a3a3"
      activeColor="#2dd4bf"
      imageUrl={logoBg}
      imageAlt="TrustVault mark — the product this journey describes"
      duration={1.4}
    />
  );
}
