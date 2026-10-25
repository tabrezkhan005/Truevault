"use client";

import Timeline from "@/components/ui/timeline";

/**
 * How-it-works section: horizontal scroll timeline of TrustVault's access path.
 * Keeps #how-it-works for nav anchors; colours match the black / teal landing.
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
      imageUrl="https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1600&q=80"
      imageAlt="Documents and laptop on a desk — the kind of files TrustVault protects"
      duration={1.4}
    />
  );
}
