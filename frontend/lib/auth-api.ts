/** Session auth helpers — CSRF cookie + login/register via /bff → Django. */

import { djangoApiPath, ensureCsrfCookie } from "@/lib/api";

export type AuthUser = {
  id: string;
  email: string;
  role: string;
};

export type SignupRole = "viewer" | "owner" | "admin";

async function parseAuthError(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const body = (await response.json()) as {
      detail?: string | string[] | Record<string, unknown>;
      password?: string[];
      email?: string[];
      role?: string[];
    };
    if (typeof body.detail === "string") return body.detail;
    if (Array.isArray(body.detail)) return body.detail.map(String).join(" ");
    const parts: string[] = [];
    for (const key of ["password", "email", "role"] as const) {
      const val = body[key];
      if (Array.isArray(val)) parts.push(...val.map(String));
    }
    if (parts.length) return parts.join(" ");
  } catch {
    /* keep default */
  }
  return fallback;
}

export async function loginWithPassword(
  email: string,
  password: string,
): Promise<{ ok: true; user: AuthUser } | { ok: false; detail: string }> {
  const csrf = await ensureCsrfCookie();
  const response = await fetch(djangoApiPath("/api/auth/login"), {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(csrf ? { "X-CSRFToken": csrf } : {}),
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    return {
      ok: false,
      detail: await parseAuthError(response, "Invalid credentials"),
    };
  }

  const user = (await response.json()) as AuthUser;
  return { ok: true, user };
}

export async function registerWithPassword(
  email: string,
  password: string,
  role: SignupRole,
): Promise<{ ok: true; user: AuthUser } | { ok: false; detail: string }> {
  const csrf = await ensureCsrfCookie();
  const response = await fetch(djangoApiPath("/api/auth/register"), {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(csrf ? { "X-CSRFToken": csrf } : {}),
    },
    body: JSON.stringify({ email, password, role }),
  });

  if (!response.ok) {
    return {
      ok: false,
      detail: await parseAuthError(response, "Could not create account"),
    };
  }

  const user = (await response.json()) as AuthUser;
  return { ok: true, user };
}
