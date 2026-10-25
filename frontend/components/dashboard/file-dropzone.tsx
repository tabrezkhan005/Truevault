"use client";

import { useCallback, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/format";
import { isApiError, uploadWithProgress, type DocumentRow } from "@/lib/api";

const HINT_TYPES = "pdf, png, jpg, txt, docx, xlsx";
const HINT_MAX = "5 MB";

export function FileDropzone({
  onUploaded,
  className,
}: {
  onUploaded?: (doc: DocumentRow) => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pick = useCallback((f: File | null) => {
    setFile(f);
    setError(null);
    if (f && !name) setName(f.name.replace(/\.[^.]+$/, "").slice(0, 120));
  }, [name]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Choose a file first");
      return;
    }
    setBusy(true);
    setError(null);
    setProgress(0);
    const fd = new FormData();
    fd.append("file", file);
    if (name.trim()) fd.append("name", name.trim());
    if (category.trim()) fd.append("category", category.trim());
    try {
      const doc = await uploadWithProgress<DocumentRow>(
        "/api/documents/",
        fd,
        setProgress,
      );
      setFile(null);
      setName("");
      setCategory("");
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
      onUploaded?.(doc);
    } catch (err) {
      setError(isApiError(err) ? err.detail : "Upload failed");
      setProgress(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void onSubmit(e)}
      className={cn("space-y-4", className)}
    >
      <div
        className={cn(
          "rounded-xl border border-dashed border-border bg-surface px-4 py-8 text-center transition-colors",
          dragging && "border-primary bg-primary/10",
        )}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0] ?? null;
          pick(f);
        }}
      >
        <p className="text-sm text-foreground">
          {file ? file.name : "Drag a file here, or choose one"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Hints only (server validates): up to {HINT_MAX}; types {HINT_TYPES}.
          {file ? ` · ${formatBytes(file.size)}` : null}
        </p>
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          aria-label="Choose file"
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => inputRef.current?.click()}
        >
          Browse
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Display name</span>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            placeholder="Optional"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Category</span>
          <Input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            maxLength={64}
            placeholder="Optional"
          />
        </label>
      </div>

      {progress !== null ? (
        <div className="space-y-1" aria-live="polite">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="font-mono text-xs text-muted-foreground">{progress}%</p>
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={busy || !file}>
        {busy ? "Uploading…" : "Upload"}
      </Button>
    </form>
  );
}
