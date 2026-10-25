import type { AuthUser } from "@/lib/api";

/** Map role → home path. Cosmetic routing only — Django still decides access. */
export function homeForRole(role: string): string {
  if (role === "admin") return "/admin";
  if (role === "owner") return "/owner";
  return "/viewer";
}

export function homeForUser(user: Pick<AuthUser, "role"> | null | undefined): string {
  if (!user) return "/";
  return homeForRole(user.role);
}
