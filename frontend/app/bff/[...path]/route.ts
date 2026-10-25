import { type NextRequest, NextResponse } from "next/server";

const BACKEND_ORIGIN =
  process.env.BACKEND_ORIGIN ?? "http://127.0.0.1:8000";

/**
 * Browser → /bff/* → Django /api/*.
 * WHY /bff not /api: Chrome caches permanent slash 301s on /api/documents/
 * which caused ERR_TOO_MANY_REDIRECTS even after the proxy was fixed.
 */
function backendUrl(pathParts: string[], search: string): string {
  let path = pathParts.map(decodeURIComponent).join("/");
  path = path.replace(/\/+$/, "");
  const isAuth = path === "auth" || path.startsWith("auth/");
  if (!isAuth && path.length > 0) path = `${path}/`;
  return `${BACKEND_ORIGIN}/api/${path}${search}`;
}

function forwardRequestHeaders(req: NextRequest): Headers {
  const headers = new Headers();
  for (const name of [
    "accept",
    "accept-language",
    "content-type",
    "cookie",
    "x-csrftoken",
    "x-requested-with",
  ]) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

async function fetchBackend(
  url: string,
  init: RequestInit,
  hops = 0,
): Promise<Response> {
  const upstream = await fetch(url, { ...init, redirect: "manual" });
  if (hops >= 5 || ![301, 302, 303, 307, 308].includes(upstream.status)) {
    return upstream;
  }
  const location = upstream.headers.get("location");
  if (!location) return upstream;
  const nextUrl = new URL(location, url);
  if (nextUrl.origin !== new URL(BACKEND_ORIGIN).origin) return upstream;

  const method = (init.method || "GET").toUpperCase();
  const nextInit: RequestInit = {
    ...init,
    method:
      [301, 302, 303].includes(upstream.status) && method !== "HEAD"
        ? "GET"
        : method,
    redirect: "manual",
  };
  if (nextInit.method === "GET" || nextInit.method === "HEAD") {
    delete nextInit.body;
  }
  return fetchBackend(nextUrl.toString(), nextInit, hops + 1);
}

async function proxy(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  const url = backendUrl(path ?? [], req.nextUrl.search);
  const method = req.method.toUpperCase();
  const init: RequestInit = {
    method,
    headers: forwardRequestHeaders(req),
    redirect: "manual",
    cache: "no-store",
  };
  if (method !== "GET" && method !== "HEAD") {
    const body = await req.arrayBuffer();
    if (body.byteLength > 0) init.body = body;
  }

  let upstream: Response;
  try {
    upstream = await fetchBackend(url, init);
  } catch {
    return NextResponse.json(
      { detail: "Backend unreachable" },
      { status: 502 },
    );
  }

  if ([301, 302, 303, 307, 308].includes(upstream.status)) {
    return NextResponse.json(
      { detail: "Upstream redirect could not be resolved", backend: url },
      { status: 502 },
    );
  }

  const outHeaders = new Headers();
  for (const name of [
    "content-type",
    "content-disposition",
    "x-content-type-options",
    "cache-control",
  ]) {
    const value = upstream.headers.get(name);
    if (value) outHeaders.set(name, value);
  }
  const cookies =
    typeof upstream.headers.getSetCookie === "function"
      ? upstream.headers.getSetCookie()
      : [];
  if (cookies.length > 0) {
    for (const cookie of cookies) outHeaders.append("set-cookie", cookie);
  } else {
    const single = upstream.headers.get("set-cookie");
    if (single) outHeaders.set("set-cookie", single);
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: outHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const HEAD = proxy;
export const OPTIONS = proxy;
