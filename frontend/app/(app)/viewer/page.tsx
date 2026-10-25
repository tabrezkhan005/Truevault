"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { AppShell } from "@/components/app/app-shell";
import { useAuth } from "@/components/app/auth-provider";
import { DocumentsTable } from "@/components/dashboard/documents-table";
import { RoleGuard } from "@/components/dashboard/role-guard";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import {
  Web3Bento,
  allocationFromDocuments,
  historyFromDocuments,
  type VaultActivity,
  type VaultDocCard,
} from "@/components/ui/web3-bento";
import { apiFetch, type DocumentRow, type Paginated } from "@/lib/api";
import { formatBytes, formatTs } from "@/lib/format";

function ViewerDashboardInner() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const showDocuments = searchParams.get("view") === "documents";

  const [total, setTotal] = useState(0);
  const [chartRows, setChartRows] = useState<DocumentRow[]>([]);

  const loadOverview = useCallback(async () => {
    try {
      const data = await apiFetch<Paginated<DocumentRow>>(
        "/api/documents/?page=1&page_size=50",
      );
      setTotal(data.count);
      setChartRows(data.results);
    } catch {
      setTotal(0);
      setChartRows([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void loadOverview();
    });
    return () => {
      cancelled = true;
    };
  }, [loadOverview]);

  const totalBytes = chartRows.reduce((s, r) => s + r.size_bytes, 0);
  const history = useMemo(() => historyFromDocuments(chartRows, 30), [chartRows]);
  const allocation = useMemo(
    () => allocationFromDocuments(chartRows),
    [chartRows],
  );
  const levels = useMemo(() => {
    const o = { owner: 0, edit: 0, read: 0 };
    for (const r of chartRows) {
      if (r.effective_level === "owner") o.owner += 1;
      else if (r.effective_level === "edit") o.edit += 1;
      else o.read += 1;
    }
    return o;
  }, [chartRows]);

  const recentDocs: VaultDocCard[] = chartRows.slice(0, 5).map((d) => ({
    id: d.id,
    name: d.name,
    category: d.category,
    sizeLabel: formatBytes(d.size_bytes),
    level: d.effective_level || "read",
    href: `/documents/${d.id}`,
  }));

  const activity: VaultActivity[] = chartRows.slice(0, 5).map((d) => ({
    id: d.id,
    kind: d.effective_level === "edit" ? "edit" : "download",
    title: d.name,
    detail: `Access: ${d.effective_level || "read"}`,
    amount: formatBytes(d.size_bytes),
    status: "allowed",
    time: formatTs(d.created_at),
  }));

  return (
    <AppShell title={showDocuments ? "Shared with me" : "Dashboard"}>
      {showDocuments ? (
        <div className="space-y-6">
          <PageHeader
            title="Shared with me"
            description="Documents granted to you. Upload is not available for viewers."
          />
          <DocumentsTable
            emptyTitle="Nothing has been shared with you yet."
            emptyDescription="When an owner grants you access, documents appear here."
            showOwnerFilter
          />
        </div>
      ) : (
        <div className="space-y-6">
          <Web3Bento
            account={user?.email || "viewer"}
            role="viewer"
            documentCount={total}
            totalBytes={totalBytes}
            history={history}
            allocation={allocation}
            levels={levels}
            recentDocs={recentDocs}
            activity={activity}
            caption={`Based on ${chartRows.length} loaded visible documents (≤ 50); server total is ${total}.`}
          />
          <div className="flex justify-end">
            <Button asChild variant="outline">
              <Link href="/viewer?view=documents">Open shared documents →</Link>
            </Button>
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default function ViewerPage() {
  return (
    <RoleGuard allow={["viewer"]}>
      <Suspense
        fallback={
          <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
            Loading…
          </div>
        }
      >
        <ViewerDashboardInner />
      </Suspense>
    </RoleGuard>
  );
}
