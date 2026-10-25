/**
 * Allow only same-origin relative paths (single leading slash).
 * Reject protocol-relative and absolute URLs (open-redirect defence).
 */
export function safeRedirectPath(
  candidate: string | null | undefined,
  fallback = "/",
): string {
  if (!candidate) return fallback;
  const value = candidate.trim();
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.includes("://") || value.includes("\\")) {
    return fallback;
  }
  if (value.includes("\0") || value.includes("\r") || value.includes("\n")) {
    return fallback;
  }
  return value;
}
