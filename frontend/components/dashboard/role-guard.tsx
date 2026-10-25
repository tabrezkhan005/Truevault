"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/app/auth-provider";
import { homeForRole } from "@/lib/role-home";

/**
 * guards and hidden buttons are UX only; Django decides on every request.
 */
export function RoleGuard({
  allow,
  children,
}: {
  allow: Array<"admin" | "owner" | "viewer">;
  children: ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/");
      return;
    }
    if (!allow.includes(user.role as "admin" | "owner" | "viewer")) {
      // Wrong-role navigation redirects to the user's own home.
      router.replace(homeForRole(user.role));
    }
  }, [allow, loading, router, user]);

  if (loading || !user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        Checking session…
      </div>
    );
  }

  if (!allow.includes(user.role as "admin" | "owner" | "viewer")) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        Redirecting…
      </div>
    );
  }

  return children;
}
