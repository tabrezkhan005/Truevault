"use client";

import { useEffect, useState } from "react";

import { subscribeColdStart } from "@/lib/api";

export function ColdStartBanner() {
  const [active, setActive] = useState(false);

  useEffect(() => subscribeColdStart(setActive), []);

  if (!active) return null;

  return (
    <div
      className="border-b border-warning/30 bg-warning/10 px-4 py-2 text-center text-sm text-warning"
      role="status"
      aria-live="polite"
    >
      Waking up the server…
    </div>
  );
}
