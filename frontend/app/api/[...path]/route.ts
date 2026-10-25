import { NextResponse } from "next/server";

/**
 * Legacy /api/* browser path — do not proxy.
 * Chrome may have cached slash 301 loops here; clients must use /bff/*.
 */
async function gone() {
  return NextResponse.json(
    {
      detail:
        "Use /bff/... instead of /api/... (cached redirect loop on /api/documents).",
    },
    {
      status: 410,
      headers: {
        // Stop browsers from keeping a redirect cache on this path.
        "Cache-Control": "no-store",
      },
    },
  );
}

export const GET = gone;
export const POST = gone;
export const PUT = gone;
export const PATCH = gone;
export const DELETE = gone;
export const HEAD = gone;
export const OPTIONS = gone;
