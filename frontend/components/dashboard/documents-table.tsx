"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import { Badge, accessBadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import {
  apiFetch,
  isApiError,
  type DocumentRow,
  type Paginated,
} from "@/lib/api";
import { formatBytes, formatTs } from "@/lib/format";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

export function DocumentsTable({
  emptyTitle,
  emptyDescription,
  showOwnerFilter = true,
  fixedFilters,
  rowActions,
  className,
}: {
  emptyTitle: string;
  emptyDescription?: string;
  showOwnerFilter?: boolean;
  fixedFilters?: Record<string, string>;
  rowActions?: (doc: DocumentRow) => ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const page = Math.max(1, Number(searchParams.get("page") || "1") || 1);
  const q = searchParams.get("q") || "";
  const category = searchParams.get("category") || "";
  const owner = searchParams.get("owner") || "";
  const createdAfter = searchParams.get("created_after") || "";
  const createdBefore = searchParams.get("created_before") || "";

  const [qDraft, setQDraft] = useState(q);
  const [rows, setRows] = useState<DocumentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fixedKey = JSON.stringify(fixedFilters ?? {});

  const setParams = useCallback(
    (patch: Record<string, string | null>, resetPage = false) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") next.delete(k);
        else next.set(k, v);
      }
      if (resetPage) next.set("page", "1");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (qDraft !== q) setParams({ q: qDraft || null }, true);
    }, 300);
    return () => window.clearTimeout(t);
  }, [qDraft, q, setParams]);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("page_size", String(PAGE_SIZE));
    if (q.trim()) params.set("q", q.trim());
    if (category.trim()) params.set("category", category.trim());
    if (owner.trim()) params.set("owner", owner.trim());
    if (createdAfter) params.set("created_after", createdAfter);
    if (createdBefore) params.set("created_before", createdBefore);
    const fixed = fixedKey ? (JSON.parse(fixedKey) as Record<string, string>) : {};
    for (const [k, v] of Object.entries(fixed)) {
      if (v) params.set(k, v);
    }
    try {
      const data = await apiFetch<Paginated<DocumentRow>>(
        `/api/documents/?${params.toString()}`,
        { signal: ac.signal },
      );
      if (ac.signal.aborted) return;
      setRows(data.results);
      setTotal(data.count);
    } catch (err) {
      if (ac.signal.aborted) return;
      if (isApiError(err) && err.status === 401) {
        router.replace("/");
        return;
      }
      setRows([]);
      setTotal(0);
      setError(isApiError(err) ? err.detail : "Failed to load documents");
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }, [
    page,
    q,
    category,
    owner,
    createdAfter,
    createdBefore,
    fixedKey,
    router,
  ]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, [load]);

  return (
    <div className={cn("space-y-4", className)}>
      <div className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="space-y-1 text-sm sm:col-span-2 lg:col-span-1">
          <span className="text-muted-foreground">Search name</span>
          <Input
            value={qDraft}
            onChange={(e) => setQDraft(e.target.value)}
            placeholder="Debounced search"
            aria-label="Search by name"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Category</span>
          <Input
            value={category}
            onChange={(e) => setParams({ category: e.target.value || null }, true)}
            placeholder="Filter"
          />
        </label>
        {showOwnerFilter ? (
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Owner email</span>
            <Input
              value={owner}
              onChange={(e) => setParams({ owner: e.target.value || null }, true)}
              placeholder="Exact email"
            />
          </label>
        ) : null}
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Created after</span>
          <Input
            type="date"
            value={createdAfter}
            onChange={(e) =>
              setParams({ created_after: e.target.value || null }, true)
            }
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Created before</span>
          <Input
            type="date"
            value={createdBefore}
            onChange={(e) =>
              setParams({ created_before: e.target.value || null }, true)
            }
          />
        </label>
        <div className="flex items-end">
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-border bg-surface-elevated text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium">Owner</th>
              <th className="px-3 py-2 font-medium">Size</th>
              <th className="px-3 py-2 font-medium">Created</th>
              <th className="px-3 py-2 font-medium">Access</th>
              {rowActions ? (
                <th className="px-3 py-2 font-medium">Actions</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border/60">
                  <td colSpan={rowActions ? 7 : 6} className="px-3 py-3">
                    <Skeleton className="h-5 w-full" />
                  </td>
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={rowActions ? 7 : 6} className="p-0">
                  <EmptyState title={emptyTitle} description={emptyDescription} />
                </td>
              </tr>
            ) : (
              rows.map((doc) => (
                <tr
                  key={doc.id}
                  className="border-b border-border/60 hover:bg-muted/40"
                >
                  <td className="px-3 py-2">
                    <Link
                      href={`/documents/${doc.id}`}
                      className="font-medium text-foreground hover:text-primary"
                    >
                      {doc.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {doc.category || "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                    {doc.owner_email || doc.owner_id}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {formatBytes(doc.size_bytes)}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                    {formatTs(doc.created_at)}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={accessBadgeVariant(doc.effective_level)}>
                      {doc.effective_level || "visible"}
                    </Badge>
                  </td>
                  {rowActions ? (
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">{rowActions(doc)}</div>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        onPageChange={(p) => setParams({ page: String(p) })}
      />
    </div>
  );
}
