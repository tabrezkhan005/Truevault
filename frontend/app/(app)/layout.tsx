import type { ReactNode } from "react";

/**
 * Authenticated app segment. Role routes live under this group.
 * guards and hidden buttons are UX only; Django decides on every request.
 */
export default function AppSegmentLayout({ children }: { children: ReactNode }) {
  return children;
}
