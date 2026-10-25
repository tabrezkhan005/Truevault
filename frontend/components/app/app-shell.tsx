"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import {
  ChevronsLeft,
  ChevronsRight,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Users,
  X,
} from "lucide-react";

import { useAuth } from "@/components/app/auth-provider";
import { ColdStartBanner } from "@/components/dashboard/cold-start-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { homeForRole } from "@/lib/role-home";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: ReactNode };

function navActive(
  item: NavItem,
  pathname: string,
  searchParams: URLSearchParams,
  home: string,
): boolean {
  const [path, qs] = item.href.split("?");
  if (pathname !== path && !(path !== home && pathname.startsWith(path + "/"))) {
    return false;
  }
  const itemParams = new URLSearchParams(qs || "");
  const itemView = itemParams.get("view");
  const itemTab = itemParams.get("tab");
  const curView = searchParams.get("view");
  const curTab = searchParams.get("tab");

  if (itemTab) return curTab === itemTab;
  if (itemView === "documents") return curView === "documents";
  // Dashboard / overview: active when not on documents view (same path)
  if (path === home || path === pathname) {
    if (itemView == null && !itemTab) return curView !== "documents" && !curTab;
  }
  return !itemView && !itemTab;
}

function SidebarNav({
  items,
  home,
  pathname,
  searchParams,
  collapsed,
  onNavigate,
}: {
  items: NavItem[];
  home: string;
  pathname: string;
  searchParams: URLSearchParams;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-col gap-1" aria-label="App">
      {items.map((item) => {
        const active = navActive(item, pathname, searchParams, home);
        return (
          <Link
            key={item.href + item.label}
            href={item.href}
            onClick={onNavigate}
            title={item.label}
            className={cn(
              "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              collapsed && "justify-center px-2",
              active
                ? "bg-white/10 text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {item.icon}
            {!collapsed ? <span>{item.label}</span> : null}
            {collapsed ? <span className="sr-only">{item.label}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

function AppShellInner({
  children,
  title,
}: {
  children: ReactNode;
  title?: string;
}) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background text-sm text-muted-foreground">
        {loading ? "Loading…" : "Redirecting…"}
      </div>
    );
  }

  const home = homeForRole(user.role);
  const nav: NavItem[] = [
    {
      href: home,
      label: "Dashboard",
      icon: <LayoutDashboard className="h-4 w-4 shrink-0" aria-hidden />,
    },
  ];

  // COSMETIC role nav — API still enforces permissions.
  if (user.role === "owner") {
    nav.push({
      href: "/owner?view=documents",
      label: "My documents",
      icon: <FileText className="h-4 w-4 shrink-0" aria-hidden />,
    });
  }
  if (user.role === "viewer") {
    nav.push({
      href: "/viewer?view=documents",
      label: "Shared with me",
      icon: <FileText className="h-4 w-4 shrink-0" aria-hidden />,
    });
  }
  if (user.role === "admin") {
    nav.push(
      {
        href: "/admin?tab=audit",
        label: "Audit",
        icon: <FileText className="h-4 w-4 shrink-0" aria-hidden />,
      },
      {
        href: "/admin?tab=users",
        label: "Users",
        icon: <Users className="h-4 w-4 shrink-0" aria-hidden />,
      },
    );
  }

  const pageTitle =
    title ||
    nav.find((n) => navActive(n, pathname, searchParams, home))?.label ||
    "TrustVault";

  return (
    <div className="min-h-svh bg-background text-foreground">
      <ColdStartBanner />
      <div className="flex min-h-svh">
        <aside
          className={cn(
            "sticky top-0 hidden h-svh shrink-0 flex-col border-r border-border bg-surface p-3 transition-[width] duration-200 md:flex",
            collapsed ? "w-[4.25rem]" : "w-56 p-4",
          )}
        >
          <div
            className={cn(
              "flex items-start gap-2",
              collapsed ? "flex-col items-center" : "justify-between",
            )}
          >
            {!collapsed ? (
              <div>
                <Link href={home} className="font-heading text-lg font-semibold">
                  TrustVault
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">Secure sharing</p>
              </div>
            ) : (
              <Link
                href={home}
                className="font-heading text-sm font-semibold"
                title="TrustVault"
              >
                TV
              </Link>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
              onClick={() => setCollapsed((v) => !v)}
            >
              {collapsed ? (
                <ChevronsRight className="h-4 w-4" />
              ) : (
                <ChevronsLeft className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="mt-6 flex-1">
            <SidebarNav
              items={nav}
              home={home}
              pathname={pathname}
              searchParams={searchParams}
              collapsed={collapsed}
            />
          </div>
        </aside>

        {drawerOpen ? (
          <div className="fixed inset-0 z-50 md:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-black/70"
              aria-label="Close menu"
              onClick={() => setDrawerOpen(false)}
            />
            <aside className="relative z-10 flex h-full w-64 flex-col bg-surface p-4">
              <div className="mb-4 flex items-center justify-between">
                <span className="font-heading text-lg font-semibold">TrustVault</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Close navigation"
                  onClick={() => setDrawerOpen(false)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <SidebarNav
                items={nav}
                home={home}
                pathname={pathname}
                searchParams={searchParams}
                collapsed={false}
                onNavigate={() => setDrawerOpen(false)}
              />
            </aside>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  aria-label="Open navigation"
                  onClick={() => setDrawerOpen(true)}
                >
                  <Menu className="h-5 w-5" />
                </Button>
                <h1 className="truncate font-heading text-base font-semibold sm:text-lg">
                  {pageTitle}
                </h1>
                <Badge variant="muted" className="hidden sm:inline-flex">
                  {user.role}
                </Badge>
              </div>

              <div className="relative">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen((v) => !v)}
                >
                  <span className="max-w-[10rem] truncate">{user.email}</span>
                </Button>
                {menuOpen ? (
                  <div
                    role="menu"
                    className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-border bg-surface p-2"
                  >
                    <p className="px-2 py-1 font-mono text-xs text-muted-foreground">
                      {user.email}
                    </p>
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-foreground hover:bg-muted"
                      onClick={() => {
                        setMenuOpen(false);
                        void logout();
                      }}
                    >
                      <LogOut className="h-4 w-4" aria-hidden />
                      Logout
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </header>

          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
        </div>
      </div>
    </div>
  );
}

/**
 * App chrome after sign-in.
 * guards and hidden buttons are UX only; Django decides on every request.
 */
export function AppShell({
  children,
  title,
}: {
  children: ReactNode;
  title?: string;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh items-center justify-center bg-background text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <AppShellInner title={title}>{children}</AppShellInner>
    </Suspense>
  );
}
