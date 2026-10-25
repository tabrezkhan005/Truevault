"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/app/auth-provider";
import { homeForUser } from "@/lib/role-home";

/** Legacy path — send each role to their dashboard home. */
export default function DocumentsRedirectPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(homeForUser(user));
  }, [loading, user, router]);

  return (
    <div className="flex min-h-svh items-center justify-center bg-background text-sm text-muted-foreground">
      Redirecting…
    </div>
  );
}
