"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { AppShell } from "@/components/app/app-shell";
import { useAuth } from "@/components/app/auth-provider";
import { DocumentsTable } from "@/components/dashboard/documents-table";
import { FileDropzone } from "@/components/dashboard/file-dropzone";
import { RoleGuard } from "@/components/dashboard/role-guard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import {
  Web3Bento,
  allocationFromDocuments,
  historyFromDocuments,
  type VaultActivity,
  type VaultDocCard,
} from "@/components/ui/web3-bento";
import { apiFetch, apiHref, type DocumentRow, type Paginated } from "@/lib/api";
import { formatBytes, formatTs } from "@/lib/format";

function DocumentsPanel({
  fixedMine,
  refreshKey,
  onUploaded,
}: {
  fixedMine?: Record<string, string>;
  refreshKey: number;
  onUploaded: () => void;
}) {
  return (
    <div className="space-y-6" id="documents-panel">
      <PageHeader
        title="My documents"
        description="Upload, open, share, or download. Server authorizes every action."
      />
      <Card className="rounded-[26px]">
        <CardHeader>
          <CardTitle>Upload</CardTitle>
          <CardDescription>
            Owners only. Server validates size, type, and magic bytes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FileDropzone onUploaded={onUploaded} />
        </CardContent>
      </Card>
      <DocumentsTable
        key={refreshKey}
        emptyTitle="You have not uploaded any documents yet."
        emptyDescription="Use the upload card above to add your first file."
        showOwnerFilter={false}
        fixedFilters={fixedMine}
        rowActions={(doc) => (
          <>
            <Button asChild size="sm" variant="ghost">
              <Link href={`/documents/${doc.id}`}>Open</Link>
            </Button>
            <Button asChild size="sm" variant="ghost">
              <a href={apiHref(`/api/documents/${doc.id}/download/`)}>Download</a>
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link href={`/documents/${doc.id}#sharing`}>Share</Link>
            </Button>
          </>
        )}
      />
    </div>
  );
}

function OwnerDashboardInner() {
  const { user } = useAuth();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const showDocuments = searchParams.get("view") === "documents";

  const [myCount, setMyCount] = useState(0);
  const [chartRows, setChartRows] = useState<DocumentRow[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const ownerEmail = user?.email ?? "";
  const fixedMine = ownerEmail ? { owner: ownerEmail } : undefined;

  const loadStats = useCallback(async () => {
    if (!ownerEmail) return;
    try {
      const mine = await apiFetch<Paginated<DocumentRow>>(
        `/api/documents/?owner=${encodeURIComponent(ownerEmail)}&page=1&page_size=50`,
      );
      setMyCount(mine.count);
      setChartRows(mine.results);
    } catch {
      setMyCount(0);
      setChartRows([]);
    }
  }, [ownerEmail]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void loadStats();
    });
    return () => {
      cancelled = true;
    };
  }, [loadStats, refreshKey]);

  const onUploaded = () => {
    toast("Upload complete", "success");
    setRefreshKey((k) => k + 1);
  };

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
    level: d.effective_level || "owner",
    href: `/documents/${d.id}`,
  }));

  const activity: VaultActivity[] = chartRows.slice(0, 5).map((d) => ({
    id: d.id,
    kind: "upload",
    title: d.name,
    detail: d.category || "uncategorised",
    amount: formatBytes(d.size_bytes),
    status: "allowed",
    time: formatTs(d.created_at),
    href: `/documents/${d.id}`,
  }));

  const caption = `Based on ${chartRows.length} of your documents loaded (≤ 50); server total owned is ${myCount}.`;

  return (
    <AppShell title={showDocuments ? "My documents" : "Dashboard"}>
      {showDocuments ? (
        <DocumentsPanel
          fixedMine={fixedMine}
          refreshKey={refreshKey}
          onUploaded={onUploaded}
        />
      ) : (
        <div className="space-y-6">
          <Web3Bento
            account={ownerEmail || "owner"}
            role="owner"
            documentCount={myCount}
            totalBytes={totalBytes}
            history={history}
            allocation={allocation}
            levels={levels}
            recentDocs={recentDocs}
            activity={activity}
            caption={caption}
          />
          <div className="flex justify-end">
            <Button asChild variant="outline">
              <Link href="/owner?view=documents">Open my documents →</Link>
            </Button>
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default function OwnerPage() {
  return (
    <RoleGuard allow={["owner"]}>
      <Suspense
        fallback={
          <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
            Loading…
          </div>
        }
      >
        <OwnerDashboardInner />
      </Suspense>
    </RoleGuard>
  );
}
