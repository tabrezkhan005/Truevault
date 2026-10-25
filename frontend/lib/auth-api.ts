/** Session auth helpers — CSRF cookie + login via /bff → Django. */

import { djangoApiPath, ensureCsrfCookie } from "@/lib/api";

export type AuthUser = {
  id: string;
  email: string;
  role: string;
};

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
    let detail = "Invalid credentials";
    try {
      const body = (await response.json()) as { detail?: string };
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      /* keep default */
    }
    return { ok: false, detail };
  }

  const user = (await response.json()) as AuthUser;
  return { ok: true, user };
}
