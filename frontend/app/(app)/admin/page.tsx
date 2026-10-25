"use client";

import { Fragment, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppShell } from "@/components/app/app-shell";
import { useAuth } from "@/components/app/auth-provider";
import { RoleGuard } from "@/components/dashboard/role-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import {
  Web3Bento,
  type VaultActivity,
  type VaultAllocation,
} from "@/components/ui/web3-bento";
import {
  apiFetch,
  isApiError,
  type AdminUserRow,
  type AuditRow,
  type Paginated,
} from "@/lib/api";
import { formatTs, truncateId } from "@/lib/format";

const PAGE_SIZE = 20;

function AdminDashboardInner() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") || "overview";

  const setTab = (value: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value === "overview") next.delete("tab");
    else next.set("tab", value);
    const qs = next.toString();
    router.replace(qs ? `/admin?${qs}` : "/admin", { scroll: false });
  };

  /* —— Users —— */
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersPage, setUsersPage] = useState(1);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [confirmUser, setConfirmUser] = useState<{
    id: string;
    label: string;
    body: { role?: string; is_active?: boolean };
  } | null>(null);
  const [userBusy, setUserBusy] = useState(false);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const data = await apiFetch<Paginated<AdminUserRow>>(
        `/api/admin/users/?page=${usersPage}&page_size=${PAGE_SIZE}`,
      );
      setUsers(data.results);
      setUsersTotal(data.count);
    } catch (err) {
      setUsers([]);
      setUsersTotal(0);
      setUsersError(isApiError(err) ? err.detail : "Failed to load users");
    } finally {
      setUsersLoading(false);
    }
  }, [usersPage]);

  /* —— Audit —— */
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditLoading, setAuditLoading] = useState(true);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [actor, setActor] = useState("");
  const [action, setAction] = useState("");
  const [outcome, setOutcome] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [date, setDate] = useState("");
  const [deniedOnly, setDeniedOnly] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const loadAudit = useCallback(async () => {
    setAuditLoading(true);
    setAuditError(null);
    const params = new URLSearchParams();
    params.set("page", String(auditPage));
    params.set("page_size", String(PAGE_SIZE));
    if (actor.trim()) params.set("actor", actor.trim());
    if (action.trim()) params.set("action", action.trim());
    const out = deniedOnly ? "denied" : outcome.trim();
    if (out) params.set("outcome", out);
    if (documentId.trim()) params.set("document", documentId.trim());
    if (date) params.set("date", date);
    try {
      const data = await apiFetch<Paginated<AuditRow>>(
        `/api/admin/audit/?${params.toString()}`,
      );
      setAudit(data.results);
      setAuditTotal(data.count);
    } catch (err) {
      setAudit([]);
      setAuditTotal(0);
      setAuditError(isApiError(err) ? err.detail : "Failed to load audit");
    } finally {
      setAuditLoading(false);
    }
  }, [auditPage, actor, action, outcome, documentId, date, deniedOnly]);

  /* —— Verify —— */
  const [verifyState, setVerifyState] = useState<{
    ok: boolean | null;
    broken_seq?: number;
    at: string;
    detail?: string;
  }>({ ok: null, at: "" });
  const [verifyBusy, setVerifyBusy] = useState(false);

  async function runVerify() {
    setVerifyBusy(true);
    try {
      const data = await apiFetch<{ ok: boolean; broken_seq?: number }>(
        "/api/admin/audit/verify/",
      );
      setVerifyState({
        ok: data.ok,
        broken_seq: data.broken_seq,
        at: new Date().toLocaleString(),
      });
    } catch (err) {
      if (isApiError(err) && err.status === 409 && err.body && typeof err.body === "object") {
        const body = err.body as { ok?: boolean; broken_seq?: number };
        setVerifyState({
          ok: false,
          broken_seq: body.broken_seq,
          at: new Date().toLocaleString(),
        });
      } else {
        setVerifyState({
          ok: null,
          at: new Date().toLocaleString(),
          detail: isApiError(err) ? err.detail : "Verify failed",
        });
      }
    } finally {
      setVerifyBusy(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void loadUsers();
    });
    return () => {
      cancelled = true;
    };
  }, [loadUsers]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void loadAudit();
    });
    return () => {
      cancelled = true;
    };
  }, [loadAudit]);

  const roleCounts = useMemo(() => {
    const map: Record<string, number> = { admin: 0, owner: 0, viewer: 0 };
    for (const u of users) {
      if (u.is_active) map[u.role] = (map[u.role] || 0) + 1;
    }
    return map;
  }, [users]);

  const deniedOnPage = audit.filter((r) => r.outcome === "denied").length;

  const actionBars = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of audit) map.set(row.action, (map.get(row.action) || 0) + 1);
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [audit]);

  const outcomePie = useMemo(() => {
    let allowed = 0;
    let denied = 0;
    for (const row of audit) {
      if (row.outcome === "denied") denied += 1;
      else allowed += 1;
    }
    return [
      { name: "allowed", value: allowed },
      { name: "denied", value: denied },
    ].filter((d) => d.value > 0);
  }, [audit]);

  async function applyUserPatch() {
    if (!confirmUser) return;
    setUserBusy(true);
    try {
      await apiFetch(`/api/admin/users/${confirmUser.id}/`, {
        method: "PATCH",
        body: JSON.stringify(confirmUser.body),
      });
      toast("User updated", "success");
      setConfirmUser(null);
      await loadUsers();
    } catch (err) {
      toast(isApiError(err) ? err.detail : "Update refused", "danger");
      setConfirmUser(null);
    } finally {
      setUserBusy(false);
    }
  }

  const overviewCaption = `Based on the ${audit.length} most recent events loaded (page ${auditPage}).`;

  const auditAllocation: VaultAllocation[] = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of audit) {
      map.set(row.action, (map.get(row.action) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([symbol, value]) => ({ symbol, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [audit]);

  const auditActivity: VaultActivity[] = useMemo(
    () =>
      audit.slice(0, 5).map((row) => ({
        id: row.id,
        kind: row.outcome === "denied" ? "deny" : "download",
        title: row.action,
        detail: row.actor_email || "—",
        amount: row.reason || row.outcome,
        status: row.outcome === "denied" ? "denied" : "allowed",
        time: formatTs(row.ts),
      })),
    [audit],
  );

  const auditHistory = useMemo(() => {
    // Cumulative event index on this page only (honest scope).
    return audit
      .slice()
      .reverse()
      .map((_, i) => i + 1);
  }, [audit]);

  return (
    <AppShell title="Admin">
      <div className="space-y-6">
        <PageHeader
          title="Admin"
          description="Metadata and audit only. No file downloads on admin pages — contents stay behind grants."
        />

        <Tabs
          value={tab === "audit" || tab === "users" ? tab : "overview"}
          onChange={setTab}
          items={[
            { value: "overview", label: "Overview" },
            { value: "audit", label: "Audit log" },
            { value: "users", label: "Users" },
          ]}
        />

        {(tab === "overview" || !["audit", "users"].includes(tab)) && (
          <div className="space-y-6">
            <Web3Bento
              account={user?.email || "admin"}
              role="admin"
              documentCount={auditTotal}
              totalBytes={0}
              history={auditHistory}
              allocation={auditAllocation}
              activity={auditActivity}
              levels={{
                owner: roleCounts.owner,
                edit: roleCounts.viewer,
                read: roleCounts.admin,
              }}
              caption={`${overviewCaption} Users total ${usersTotal}. Denied on this page: ${deniedOnPage}. Access tile: Owner→owners, Edit→viewers, Read→admins (active on users page).`}
              footer={
                <Card className="rounded-[26px]">
                  <CardHeader>
                    <CardTitle>Verify audit chain</CardTitle>
                    <CardDescription>
                      Reports what the verify endpoint returns — not a broader immutability claim.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button
                      type="button"
                      disabled={verifyBusy}
                      onClick={() => void runVerify()}
                      className="bg-white text-black hover:bg-white/90"
                    >
                      {verifyBusy ? "Verifying…" : "Verify chain"}
                    </Button>
                    {verifyState.at ? (
                      <p
                        className={
                          verifyState.ok === true
                            ? "text-sm text-success"
                            : verifyState.ok === false
                              ? "text-sm text-danger"
                              : "text-sm text-muted-foreground"
                        }
                        role="status"
                      >
                        {verifyState.ok === true &&
                          `OK — chain verified at ${verifyState.at}`}
                        {verifyState.ok === false &&
                          `Broken at sequence ${verifyState.broken_seq ?? "?"} (checked ${verifyState.at})`}
                        {verifyState.ok === null &&
                          (verifyState.detail || "No result") +
                            ` (${verifyState.at})`}
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              }
            />

            {!auditLoading && outcomePie.length > 0 ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Allowed vs denied</CardTitle>
                    <CardDescription>{overviewCaption}</CardDescription>
                  </CardHeader>
                  <CardContent className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={outcomePie}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={45}
                          outerRadius={70}
                        >
                          {outcomePie.map((d) => (
                            <Cell
                              key={d.name}
                              fill={d.name === "denied" ? "#ef4444" : "#22c55e"}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            background: "#0a0a0a",
                            border: "1px solid rgba(255,255,255,0.12)",
                            borderRadius: 12,
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Top actions</CardTitle>
                    <CardDescription>{overviewCaption}</CardDescription>
                  </CardHeader>
                  <CardContent className="h-56">
                    {actionBars.length === 0 ? (
                      <EmptyState title="No actions on this page" />
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={actionBars} layout="vertical" margin={{ left: 16 }}>
                          <XAxis
                            type="number"
                            allowDecimals={false}
                            tick={{ fill: "#a3a3a3", fontSize: 11 }}
                          />
                          <YAxis
                            type="category"
                            dataKey="name"
                            width={90}
                            tick={{ fill: "#a3a3a3", fontSize: 11 }}
                          />
                          <Tooltip
                            contentStyle={{
                              background: "#0a0a0a",
                              border: "1px solid rgba(255,255,255,0.12)",
                              borderRadius: 12,
                            }}
                          />
                          <Bar dataKey="value" fill="#ededed" radius={[0, 6, 6, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : null}
          </div>
        )}

        {tab === "audit" && (
          <div className="space-y-4">
            <div className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Actor (email or id)</span>
                <Input value={actor} onChange={(e) => { setActor(e.target.value); setAuditPage(1); }} />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Action</span>
                <Input value={action} onChange={(e) => { setAction(e.target.value); setAuditPage(1); }} />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Outcome</span>
                <Select
                  value={deniedOnly ? "denied" : outcome}
                  disabled={deniedOnly}
                  onChange={(e) => {
                    setOutcome(e.target.value);
                    setAuditPage(1);
                  }}
                >
                  <option value="">Any</option>
                  <option value="allowed">allowed</option>
                  <option value="denied">denied</option>
                </Select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Document id</span>
                <Input value={documentId} onChange={(e) => { setDocumentId(e.target.value); setAuditPage(1); }} />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Date (server `date` filter)</span>
                <Input type="date" value={date} onChange={(e) => { setDate(e.target.value); setAuditPage(1); }} />
              </label>
              <label className="flex items-end gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={deniedOnly}
                  onChange={(e) => {
                    setDeniedOnly(e.target.checked);
                    setAuditPage(1);
                  }}
                />
                Denied only
              </label>
            </div>

            {auditError ? (
              <p className="text-sm text-danger" role="alert">
                {auditError}
              </p>
            ) : null}

            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[48rem] text-left text-sm">
                <thead className="border-b border-border bg-surface-elevated text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Time</th>
                    <th className="px-3 py-2">Actor</th>
                    <th className="px-3 py-2">Action</th>
                    <th className="px-3 py-2">Outcome</th>
                    <th className="px-3 py-2">Reason</th>
                    <th className="px-3 py-2">Document</th>
                    <th className="px-3 py-2">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLoading ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-muted-foreground">
                        Loading…
                      </td>
                    </tr>
                  ) : audit.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-0">
                        <EmptyState title="No audit events match" />
                      </td>
                    </tr>
                  ) : (
                    audit.map((row) => (
                      <Fragment key={row.id}>
                        <tr
                          className="cursor-pointer border-b border-border/60 font-mono text-xs hover:bg-muted/40"
                          onClick={() =>
                            setExpanded((id) => (id === row.id ? null : row.id))
                          }
                        >
                          <td className="px-3 py-2 whitespace-nowrap">{formatTs(row.ts)}</td>
                          <td className="px-3 py-2">{row.actor_email || "—"}</td>
                          <td className="px-3 py-2">{row.action}</td>
                          <td className="px-3 py-2">
                            <Badge
                              variant={row.outcome === "denied" ? "danger" : "success"}
                            >
                              {row.outcome}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {row.reason || "—"}
                          </td>
                          <td className="px-3 py-2">
                            {row.document_id ? truncateId(row.document_id) : "—"}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {row.remote_addr
                              ? truncateId(row.remote_addr, 6)
                              : "—"}
                          </td>
                        </tr>
                        {expanded === row.id ? (
                          <tr className="border-b border-border/60 bg-surface">
                            <td colSpan={7} className="px-3 py-3">
                              <pre className="max-h-48 overflow-auto whitespace-pre-wrap font-mono text-xs text-muted-foreground">
                                {JSON.stringify(row.detail, null, 2)}
                              </pre>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              page={auditPage}
              pageSize={PAGE_SIZE}
              total={auditTotal}
              onPageChange={setAuditPage}
            />
          </div>
        )}

        {tab === "users" && (
          <div className="space-y-4">
            {usersError ? (
              <p className="text-sm text-danger" role="alert">
                {usersError}
              </p>
            ) : null}
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead className="border-b border-border bg-surface-elevated text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Role</th>
                    <th className="px-3 py-2">Active</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {usersLoading ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-muted-foreground">
                        Loading…
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.id} className="border-b border-border/60">
                        <td className="px-3 py-2">
                          {u.email}
                          {user?.id === u.id ? (
                            <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant="muted">{u.role}</Badge>
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={u.is_active ? "success" : "danger"}>
                            {u.is_active ? "active" : "inactive"}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-2">
                            <Select
                              className="h-8 w-auto"
                              value={u.role}
                              aria-label={`Role for ${u.email}`}
                              onChange={(e) =>
                                setConfirmUser({
                                  id: u.id,
                                  label: `Change ${u.email} role to ${e.target.value}?`,
                                  body: { role: e.target.value },
                                })
                              }
                            >
                              <option value="admin">admin</option>
                              <option value="owner">owner</option>
                              <option value="viewer">viewer</option>
                            </Select>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setConfirmUser({
                                  id: u.id,
                                  label: u.is_active
                                    ? `Deactivate ${u.email}?`
                                    : `Activate ${u.email}?`,
                                  body: { is_active: !u.is_active },
                                })
                              }
                            >
                              {u.is_active ? "Deactivate" : "Activate"}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              page={usersPage}
              pageSize={PAGE_SIZE}
              total={usersTotal}
              onPageChange={setUsersPage}
            />
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmUser}
        title="Confirm user change"
        description={
          confirmUser?.label ||
          "The server may refuse self-demotion or self-deactivation."
        }
        confirmLabel="Apply"
        danger={confirmUser?.body.is_active === false}
        busy={userBusy}
        onCancel={() => setConfirmUser(null)}
        onConfirm={() => void applyUserPatch()}
      />
    </AppShell>
  );
}

export default function AdminPage() {
  return (
    <RoleGuard allow={["admin"]}>
      <Suspense
        fallback={
          <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
            Loading…
          </div>
        }
      >
        <AdminDashboardInner />
      </Suspense>
    </RoleGuard>
  );
}
