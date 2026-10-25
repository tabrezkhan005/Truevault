"use client";

import {
  FormEvent,
  Suspense,
  useCallback,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { AppShell } from "@/components/app/app-shell";
import { RoleGuard } from "@/components/dashboard/role-guard";
import { Badge, accessBadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import {
  apiFetch,
  apiHref,
  isApiError,
  type DocumentRow,
  type GrantRow,
} from "@/lib/api";
import { formatBytes, formatTs } from "@/lib/format";
import { homeForUser } from "@/lib/role-home";
import { useAuth } from "@/components/app/auth-provider";

function DocumentDetailInner() {
  const params = useParams();
  const id = String(params.id || "");
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();

  const [doc, setDoc] = useState<DocumentRow | null>(null);
  const [grants, setGrants] = useState<GrantRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [replaceFile, setReplaceFile] = useState<File | null>(null);

  const [grantEmail, setGrantEmail] = useState("");
  const [lookup, setLookup] = useState<{ id: string; email: string } | null>(null);
  const [grantLevel, setGrantLevel] = useState<"read" | "edit">("read");
  const [grantMsg, setGrantMsg] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<GrantRow | null>(null);

  const isOwner = doc?.effective_level === "owner";
  const canEdit = doc?.effective_level === "owner" || doc?.effective_level === "edit";
  // Admin without grant: API returns 404; no download on admin-only views elsewhere.
  const canDownload = !!doc && doc.effective_level !== undefined;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<DocumentRow>(`/api/documents/${id}/`);
      setDoc(data);
      setEditName(data.name);
      setEditCategory(data.category || "");
      if (data.effective_level === "owner") {
        try {
          const g = await apiFetch<GrantRow[]>(`/api/documents/${id}/grants/`);
          setGrants(g);
        } catch {
          setGrants([]);
        }
      } else {
        setGrants([]);
      }
    } catch (err) {
      setDoc(null);
      if (isApiError(err) && err.status === 401) {
        router.replace("/");
        return;
      }
      setError(
        isApiError(err)
          ? err.detail
          : "Not found or you do not have access",
      );
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function onSaveMetadata(e: FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setBusy(true);
    try {
      const data = await apiFetch<DocumentRow>(`/api/documents/${id}/`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editName.trim(),
          category: editCategory.trim(),
        }),
      });
      setDoc(data);
      toast("Metadata saved", "success");
    } catch (err) {
      toast(isApiError(err) ? err.detail : "Save failed", "danger");
    } finally {
      setBusy(false);
    }
  }

  async function onReplaceContent(e: FormEvent) {
    e.preventDefault();
    if (!canEdit || !replaceFile) return;
    setBusy(true);
    const fd = new FormData();
    fd.append("file", replaceFile);
    try {
      const data = await apiFetch<DocumentRow>(`/api/documents/${id}/`, {
        method: "PUT",
        body: fd,
      });
      setDoc(data);
      setReplaceFile(null);
      toast("Content replaced", "success");
    } catch (err) {
      toast(isApiError(err) ? err.detail : "Replace failed", "danger");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    setBusy(true);
    try {
      await apiFetch(`/api/documents/${id}/`, { method: "DELETE" });
      toast("Document deleted", "success");
      router.replace(homeForUser(user));
    } catch (err) {
      toast(isApiError(err) ? err.detail : "Delete failed", "danger");
      setConfirmDelete(false);
    } finally {
      setBusy(false);
    }
  }

  async function onLookup(e: FormEvent) {
    e.preventDefault();
    setGrantMsg(null);
    setLookup(null);
    setBusy(true);
    try {
      const looked = await apiFetch<{ id: string; email: string }>(
        `/api/users/lookup/?email=${encodeURIComponent(grantEmail.trim())}`,
      );
      setLookup(looked);
    } catch (err) {
      setGrantMsg(isApiError(err) ? err.detail : "Lookup failed");
    } finally {
      setBusy(false);
    }
  }

  async function onConfirmGrant() {
    if (!lookup) return;
    setBusy(true);
    setGrantMsg(null);
    try {
      await apiFetch(`/api/documents/${id}/grants/`, {
        method: "POST",
        body: JSON.stringify({ user_id: lookup.id, level: grantLevel }),
      });
      setGrantMsg(`Granted ${grantLevel} to ${lookup.email}`);
      setLookup(null);
      setGrantEmail("");
      toast("Grant saved", "success");
      await load();
    } catch (err) {
      setGrantMsg(isApiError(err) ? err.detail : "Grant failed");
    } finally {
      setBusy(false);
    }
  }

  async function onChangeLevel(g: GrantRow, level: "read" | "edit") {
    setBusy(true);
    try {
      await apiFetch(`/api/documents/${id}/grants/`, {
        method: "POST",
        body: JSON.stringify({ user_id: g.user_id, level }),
      });
      toast("Access level updated", "success");
      await load();
    } catch (err) {
      toast(isApiError(err) ? err.detail : "Update failed", "danger");
    } finally {
      setBusy(false);
    }
  }

  async function onRevoke() {
    if (!revokeTarget) return;
    setBusy(true);
    try {
      await apiFetch(`/api/documents/${id}/grants/${revokeTarget.user_id}/`, {
        method: "DELETE",
      });
      toast("Revoked. Their next request will be refused.", "success");
      setRevokeTarget(null);
      await load();
    } catch (err) {
      toast(isApiError(err) ? err.detail : "Revoke failed", "danger");
      setRevokeTarget(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Document">
      <div className="space-y-6">
        <Link
          href={homeForUser(user)}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to dashboard
        </Link>

        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : error && !doc ? (
          <p className="text-danger" role="alert">
            Not found or you do not have access
          </p>
        ) : doc ? (
          <>
            <PageHeader
              title={doc.name}
              description={`${doc.category || "uncategorised"} · ${formatBytes(doc.size_bytes)} · ${formatTs(doc.created_at)}`}
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={accessBadgeVariant(doc.effective_level)}>
                    {doc.effective_level}
                  </Badge>
                  {canDownload ? (
                    <Button asChild size="sm">
                      <a href={apiHref(`/api/documents/${doc.id}/download/`)}>
                        Download
                      </a>
                    </Button>
                  ) : null}
                  {isOwner ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => setConfirmDelete(true)}
                    >
                      Delete
                    </Button>
                  ) : null}
                </div>
              }
            />

            <Card>
              <CardHeader>
                <CardTitle>Metadata</CardTitle>
                <CardDescription className="font-mono text-xs">
                  {doc.id}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Owner:{" "}
                  <span className="text-foreground">
                    {doc.owner_email || doc.owner_id}
                  </span>
                </p>
                <p>
                  Type:{" "}
                  <span className="font-mono text-foreground">
                    {doc.content_type_detected}
                  </span>
                </p>
                <p>
                  SHA-256:{" "}
                  <span className="break-all font-mono text-xs text-foreground">
                    {doc.sha256}
                  </span>
                </p>
              </CardContent>
            </Card>

            {/* COSMETIC: edit UI only when API reported edit/owner; authorize() still runs. */}
            {canEdit ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Edit metadata</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={(e) => void onSaveMetadata(e)} className="space-y-3">
                      <label className="block space-y-1 text-sm">
                        <span className="text-muted-foreground">Name</span>
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          maxLength={120}
                          required
                        />
                      </label>
                      <label className="block space-y-1 text-sm">
                        <span className="text-muted-foreground">Category</span>
                        <Input
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value)}
                          maxLength={64}
                        />
                      </label>
                      <Button type="submit" disabled={busy}>
                        Save
                      </Button>
                    </form>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Replace content</CardTitle>
                    <CardDescription>
                      Hints only: ≤ 5 MB; pdf, png, jpg, txt, docx, xlsx.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={(e) => void onReplaceContent(e)} className="space-y-3">
                      <Input
                        type="file"
                        onChange={(e) =>
                          setReplaceFile(e.target.files?.[0] ?? null)
                        }
                      />
                      <Button type="submit" disabled={busy || !replaceFile}>
                        Replace file
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </div>
            ) : null}

            {isOwner ? (
              <Card id="sharing">
                <CardHeader>
                  <CardTitle>Sharing</CardTitle>
                  <CardDescription>
                    Exact email lookup, then confirm. After revoke: their next
                    request will be refused.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <form
                    onSubmit={(e) => void onLookup(e)}
                    className="flex flex-col gap-3 sm:flex-row sm:items-end"
                  >
                    <label className="flex-1 space-y-1 text-sm">
                      <span className="text-muted-foreground">Email</span>
                      <Input
                        type="email"
                        required
                        value={grantEmail}
                        onChange={(e) => {
                          setGrantEmail(e.target.value);
                          setLookup(null);
                        }}
                        placeholder="Exact email"
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="text-muted-foreground">Level</span>
                      <Select
                        value={grantLevel}
                        onChange={(e) =>
                          setGrantLevel(e.target.value as "read" | "edit")
                        }
                      >
                        <option value="read">read</option>
                        <option value="edit">edit</option>
                      </Select>
                    </label>
                    <Button type="submit" variant="outline" disabled={busy}>
                      Look up
                    </Button>
                  </form>

                  {lookup ? (
                    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-3 text-sm">
                      <span>
                        Grant <strong>{grantLevel}</strong> to{" "}
                        <span className="font-mono">{lookup.email}</span>?
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy}
                        onClick={() => void onConfirmGrant()}
                      >
                        Confirm grant
                      </Button>
                    </div>
                  ) : null}

                  {grantMsg ? (
                    <p className="text-sm text-muted-foreground" role="status">
                      {grantMsg}
                    </p>
                  ) : null}

                  <ul className="divide-y divide-border text-sm">
                    {grants.length === 0 ? (
                      <li className="py-3 text-muted-foreground">No grants yet.</li>
                    ) : (
                      grants.map((g) => (
                        <li
                          key={g.id}
                          className="flex flex-wrap items-center justify-between gap-3 py-3"
                        >
                          <span>
                            {g.user_email}{" "}
                            <Badge variant={accessBadgeVariant(g.level)}>
                              {g.level}
                            </Badge>
                          </span>
                          <div className="flex flex-wrap gap-2">
                            <Select
                              className="h-8 w-auto"
                              value={g.level}
                              aria-label={`Level for ${g.user_email}`}
                              onChange={(e) =>
                                void onChangeLevel(
                                  g,
                                  e.target.value as "read" | "edit",
                                )
                              }
                            >
                              <option value="read">read</option>
                              <option value="edit">edit</option>
                            </Select>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              disabled={busy}
                              onClick={() => setRevokeTarget(g)}
                            >
                              Revoke
                            </Button>
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                </CardContent>
              </Card>
            ) : null}
          </>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete document?"
        description="Soft-delete. Only the owner may do this; the API enforces it."
        confirmLabel="Delete"
        danger
        busy={busy}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void onDelete()}
      />
      <ConfirmDialog
        open={!!revokeTarget}
        title="Revoke access?"
        description={
          revokeTarget
            ? `Revoke ${revokeTarget.user_email}. Their next request will be refused.`
            : ""
        }
        confirmLabel="Revoke"
        danger
        busy={busy}
        onCancel={() => setRevokeTarget(null)}
        onConfirm={() => void onRevoke()}
      />
    </AppShell>
  );
}

export default function DocumentDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <RoleGuard allow={["admin", "owner", "viewer"]}>
        <DocumentDetailInner />
      </RoleGuard>
    </Suspense>
  );
}
