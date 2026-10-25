/**
 * Browser API helper: credentials + CSRF on mutating requests.
 * Never stores tokens in localStorage.
 */

type ColdStartListener = (active: boolean) => void;

const coldStartListeners = new Set<ColdStartListener>();
let coldStartCount = 0;

export function subscribeColdStart(listener: ColdStartListener): () => void {
  coldStartListeners.add(listener);
  listener(coldStartCount > 0);
  return () => {
    coldStartListeners.delete(listener);
  };
}

function setColdStartActive(active: boolean) {
  for (const listener of coldStartListeners) listener(active);
}

function beginColdStartWatch(): () => void {
  let fired = false;
  const timer = window.setTimeout(() => {
    fired = true;
    coldStartCount += 1;
    setColdStartActive(true);
  }, 3000);
  return () => {
    window.clearTimeout(timer);
    if (fired) {
      coldStartCount = Math.max(0, coldStartCount - 1);
      setColdStartActive(coldStartCount > 0);
    }
  };
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(
      `(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]*)`,
    ),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

export async function ensureCsrfCookie(): Promise<string | null> {
  await fetch("/bff/auth/csrf", { method: "GET", credentials: "include" });
  return readCookie("csrftoken");
}

export type ApiError = {
  status: number;
  detail: string;
  body?: unknown;
};

export function isApiError(err: unknown): err is ApiError {
  return (
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    "detail" in err
  );
}

function detailFromBody(body: unknown, fallback: string): string {
  if (body && typeof body === "object") {
    const obj = body as Record<string, unknown>;
    if (typeof obj.detail === "string") return obj.detail;
    if (Array.isArray(obj.detail)) return obj.detail.map(String).join(" ");
    // Field errors from DRF validators
    const parts: string[] = [];
    for (const [key, val] of Object.entries(obj)) {
      if (key === "detail") continue;
      if (typeof val === "string") parts.push(`${key}: ${val}`);
      else if (Array.isArray(val)) parts.push(`${key}: ${val.map(String).join(" ")}`);
    }
    if (parts.length) return parts.join(" ");
  }
  return fallback;
}

function mapStatusDetail(status: number, body: unknown): string {
  if (status === 401) return detailFromBody(body, "Please sign in again");
  if (status === 404) return detailFromBody(body, "Not found or you do not have access");
  if (status === 429) return detailFromBody(body, "Rate limited — try again shortly");
  return detailFromBody(body, `Request failed (${status})`);
}

/**
 * Map logical `/api/...` paths onto the `/bff/...` Next proxy.
 * WHY /bff: avoids Chrome-cached 301 loops on `/api/documents/`.
 * Auth Django routes omit trailing slash; other collection routes require it.
 */
export function djangoApiPath(path: string): string {
  let p = path;
  if (p.startsWith("/api/")) p = `/bff/${p.slice("/api/".length)}`;
  if (!p.startsWith("/bff/")) return p;

  const q = p.indexOf("?");
  const base = q === -1 ? p : p.slice(0, q);
  const query = q === -1 ? "" : p.slice(q);
  const isAuth = base === "/bff/auth" || base.startsWith("/bff/auth/");
  if (isAuth) return p;
  if (base.endsWith("/")) return p;
  return `${base}/${query}`;
}

/** Public download / anchor helper (same /bff mapping). */
export function apiHref(path: string): string {
  return djangoApiPath(path);
}

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const method = (init.method || "GET").toUpperCase();
  const headers = new Headers(init.headers);
  const endCold = typeof window !== "undefined" ? beginColdStartWatch() : () => {};
  const url = djangoApiPath(path);

  try {
    if (!["GET", "HEAD", "OPTIONS", "TRACE"].includes(method)) {
      const csrf = await ensureCsrfCookie();
      if (csrf) headers.set("X-CSRFToken", csrf);
    }

    if (
      init.body &&
      !(init.body instanceof FormData) &&
      !headers.has("Content-Type")
    ) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(url, {
      ...init,
      headers,
      credentials: "include",
    });

    if (response.status === 204) {
      return undefined as T;
    }

    const text = await response.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }

    if (!response.ok) {
      throw {
        status: response.status,
        detail: mapStatusDetail(response.status, body),
        body,
      } satisfies ApiError;
    }

    return body as T;
  } finally {
    endCold();
  }
}

/** Multipart upload with real progress via XHR (CSRF included). */
export function uploadWithProgress<T = unknown>(
  path: string,
  formData: FormData,
  onProgress?: (pct: number) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    void (async () => {
      const endCold = beginColdStartWatch();
      try {
        const csrf = await ensureCsrfCookie();
        const xhr = new XMLHttpRequest();
        xhr.open("POST", djangoApiPath(path));
        xhr.withCredentials = true;
        if (csrf) xhr.setRequestHeader("X-CSRFToken", csrf);

        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable || !onProgress) return;
          onProgress(Math.round((event.loaded / event.total) * 100));
        };

        xhr.onload = () => {
          endCold();
          let body: unknown = null;
          if (xhr.responseText) {
            try {
              body = JSON.parse(xhr.responseText);
            } catch {
              body = xhr.responseText;
            }
          }
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(body as T);
            return;
          }
          reject({
            status: xhr.status,
            detail: mapStatusDetail(xhr.status, body),
            body,
          } satisfies ApiError);
        };

        xhr.onerror = () => {
          endCold();
          reject({
            status: 0,
            detail: "Network error — check your connection",
          } satisfies ApiError);
        };

        xhr.send(formData);
      } catch (err) {
        endCold();
        reject(err);
      }
    })();
  });
}

export type AuthUser = {
  id: string;
  email: string;
  role: string;
};

export type DocumentRow = {
  id: string;
  name: string;
  category: string;
  content_type_detected: string;
  size_bytes: number;
  sha256: string;
  created_at: string;
  updated_at: string;
  owner_id: string;
  owner_email?: string;
  effective_level?: string;
};

export type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type GrantRow = {
  id: string;
  user_id: string;
  user_email: string;
  level: "read" | "edit";
  granted_by_id: string;
  created_at: string;
};

export type AuditRow = {
  id: string;
  seq: number;
  ts: string;
  actor_id: string | null;
  actor_email: string;
  actor_role: string;
  action: string;
  outcome: string;
  reason: string;
  document_id: string | null;
  target_user_id: string | null;
  remote_addr: string;
  detail: unknown;
  prev_hash: string;
  hash: string;
};

export type AdminUserRow = {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
};
