"use client";

/**
 * Bento dashboard shell adapted from the 21st.dev Web3 Bento for TrustVault.
 * WHY no crypto DEMO defaults on dashboards: AGENTS.md forbids inventing
 * statistics — every tile is fed by the caller from real API responses.
 */

import * as React from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/format";

export interface VaultAllocation {
  symbol: string;
  value: number;
}

export interface VaultActivity {
  id: string;
  kind: "upload" | "share" | "download" | "deny" | "edit";
  title: string;
  detail: string;
  amount: string;
  status: "allowed" | "denied" | "pending";
  time: string;
  href?: string;
}

export interface VaultDocCard {
  id: string;
  name: string;
  category: string;
  sizeLabel: string;
  level: string;
  href: string;
}

export interface Web3BentoProps {
  account: string;
  role: string;
  network?: string;
  /** Document count (server total when known) */
  documentCount: number;
  totalBytes: number;
  /** Daily series for chart — real counts, oldest → newest */
  history?: number[];
  allocation?: VaultAllocation[];
  activity?: VaultActivity[];
  recentDocs?: VaultDocCard[];
  levels?: { owner: number; edit: number; read: number };
  caption?: string;
  accent?: string;
  accent2?: string;
  className?: string;
  /** Extra tile (e.g. upload dropzone) */
  footer?: React.ReactNode;
}

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

function useReducedMotion() {
  const [r, setR] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const u = () => setR(mq.matches);
    u();
    mq.addEventListener("change", u);
    return () => mq.removeEventListener("change", u);
  }, []);
  return r;
}

function useMounted() {
  const [on, setOn] = React.useState(false);
  React.useEffect(() => {
    const id = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return on;
}

function useCountUp(target: number, enabled: boolean, duration = 900) {
  const [v, setV] = React.useState(0);
  React.useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      setV(target * (1 - Math.pow(1 - p, 4)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, enabled, duration]);
  return enabled ? v : target;
}

function Tile({
  title,
  action,
  className,
  children,
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "relative flex min-w-0 flex-col overflow-hidden rounded-[26px] border border-border bg-card p-5 text-card-foreground",
        className,
      )}
    >
      {(title || action) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          {title ? (
            <h3 className="text-[13px] font-medium text-muted-foreground">{title}</h3>
          ) : (
            <span />
          )}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

function HeroTile({
  account,
  role,
  documentCount,
  totalBytes,
  history,
  accent,
  reduced,
}: {
  account: string;
  role: string;
  documentCount: number;
  totalBytes: number;
  history: number[];
  accent: string;
  reduced: boolean;
}) {
  const mounted = useMounted();
  const shown = useCountUp(documentCount, !reduced);
  const month = history.length >= 2 ? history.slice(-31) : history;
  const daily =
    month.length > 1
      ? month.slice(1).map((v, i) => v - month[i])
      : month.map(() => 0);
  const maxAbs = Math.max(...daily.map(Math.abs), 1);
  const change = daily.reduce((s, d) => s + d, 0);
  const [hover, setHover] = React.useState<number | null>(null);

  const shortName = account.includes("@") ? account.split("@")[0] : account;

  return (
    <Tile className="sm:col-span-2">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="font-heading text-[28px] font-semibold leading-[1.15] tracking-[-0.03em] sm:text-[32px]">
            Hello,{" "}
            <span className="truncate" style={{ color: accent }}>
              {shortName}
            </span>
          </p>
          <p className="mt-1 truncate font-mono text-xs text-muted-foreground" title={account}>
            {account}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {role} dashboard · documents you can see (server-enforced).
          </p>
        </div>
        <div className="shrink-0 sm:text-right">
          <p className="text-[12px] text-muted-foreground">Visible documents</p>
          <p className="font-mono text-[34px] font-semibold leading-none tracking-[-0.04em] tabular-nums sm:text-[40px]">
            {Math.round(shown)}
          </p>
          <p className="mt-1.5 font-mono text-[12px] tabular-nums text-muted-foreground">
            {formatBytes(totalBytes)}
            {daily.length > 0 ? (
              <span className="text-foreground">
                {" "}
                · {change >= 0 ? "+" : ""}
                {change} in chart window
              </span>
            ) : null}
          </p>
        </div>
      </div>

      {daily.length > 0 ? (
        <div className="mt-6 flex flex-1 flex-col">
          <div
            className="flex flex-1 items-end gap-[3px]"
            style={{ minHeight: 64 }}
            onPointerLeave={() => setHover(null)}
          >
            {daily.map((d, i) => {
              const h = 12 + (Math.abs(d) / maxAbs) * 88;
              return (
                <button
                  key={i}
                  type="button"
                  onPointerEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  aria-label={`Day ${i + 1}: ${d >= 0 ? "+" : ""}${d} docs`}
                  className="relative flex-1 rounded-[4px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  style={{
                    height: mounted ? `${h}%` : "6%",
                    background: accent,
                    opacity:
                      hover === null
                        ? 0.35 + (Math.abs(d) / maxAbs) * 0.65
                        : hover === i
                          ? 1
                          : 0.25,
                    transition: `height 900ms ${EASE} ${i * 18}ms, opacity 200ms ease`,
                  }}
                />
              );
            })}
          </div>
          <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span>Window start</span>
            <span className="text-foreground" aria-live="polite">
              {hover !== null
                ? `Δ ${daily[hover] >= 0 ? "+" : ""}${daily[hover]}`
                : "Daily change (loaded set)"}
            </span>
            <span>Today</span>
          </div>
        </div>
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">
          No time series in the loaded set yet.
        </p>
      )}
    </Tile>
  );
}

function LevelsTile({
  levels,
  accent,
}: {
  levels: { owner: number; edit: number; read: number };
  accent: string;
}) {
  const rows = [
    { label: "Owner", value: levels.owner },
    { label: "Edit", value: levels.edit },
    { label: "Read", value: levels.read },
  ];
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <Tile title="Access on loaded page">
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.label}>
            <div className="mb-1 flex justify-between text-[12px]">
              <span>{r.label}</span>
              <span className="font-mono tabular-nums">{r.value}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(r.value / max) * 100}%`,
                  background: accent,
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </Tile>
  );
}

function ChartTile({
  history,
  accent,
  caption,
}: {
  history: number[];
  accent: string;
  caption?: string;
}) {
  const mounted = useMounted();
  const W = 640;
  const H = 180;
  const a = history.length ? history : [0];
  const lo = Math.min(...a);
  const hi = Math.max(...a);
  const y = (v: number) =>
    H - 12 - ((v - lo) / (hi - lo || 1)) * (H - 28);
  const pts = a.map(
    (v, i) =>
      [(i / Math.max(a.length - 1, 1)) * W, y(v)] as const,
  );
  const d = pts
    .map(([x, yv], i) =>
      i === 0 ? `M ${x} ${yv}` : `L ${x} ${yv}`,
    )
    .join(" ");

  return (
    <Tile
      title="Documents over time"
      className="sm:col-span-2 lg:col-span-2"
      action={
        <span className="font-mono text-[11px] text-muted-foreground">
          cumulative
        </span>
      }
    >
      {caption ? (
        <p className="mb-2 text-[11px] text-muted-foreground">{caption}</p>
      ) : null}
      <div className="relative" style={{ minHeight: 180 }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
          aria-hidden
        >
          <path
            d={`${d} L ${W} ${H} L 0 ${H} Z`}
            fill={accent}
            opacity={mounted ? 0.15 : 0}
          />
          <path
            d={d}
            fill="none"
            stroke={accent}
            strokeWidth={2.5}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            style={{
              opacity: mounted ? 1 : 0,
              transition: "opacity 600ms ease",
            }}
          />
        </svg>
      </div>
      <p className="mt-2 font-mono text-[12px] tabular-nums text-muted-foreground">
        End: {a[a.length - 1] ?? 0} · Start: {a[0] ?? 0}
      </p>
    </Tile>
  );
}

function AllocationTile({
  allocation,
  accent,
  accent2,
}: {
  allocation: VaultAllocation[];
  accent: string;
  accent2: string;
}) {
  const mounted = useMounted();
  const total = allocation.reduce((s, a) => s + a.value, 0) || 1;
  const colors = [accent, accent2, "#a3a3a3", "#737373", "#525252"];
  return (
    <Tile title="By category">
      <p className="font-mono text-[22px] font-semibold tabular-nums">
        {allocation.length} groups
      </p>
      <div className="mt-4 flex h-9 gap-1">
        {allocation.map((a, i) => (
          <span
            key={a.symbol}
            className="rounded-[8px]"
            style={{
              flexBasis: mounted
                ? `${(a.value / total) * 100}%`
                : `${100 / Math.max(allocation.length, 1)}%`,
              background: colors[i % colors.length],
              transition: `flex-basis 1000ms ${EASE} ${200 + i * 60}ms`,
            }}
            aria-hidden
          />
        ))}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
        {allocation.map((a, i) => (
          <li
            key={a.symbol}
            className="flex items-center justify-between gap-2 text-[12px]"
          >
            <span className="flex items-center gap-2 truncate">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: colors[i % colors.length] }}
              />
              {a.symbol}
            </span>
            <span className="font-mono tabular-nums text-muted-foreground">
              {a.value}
            </span>
          </li>
        ))}
      </ul>
    </Tile>
  );
}

function RecentDocsTile({ docs }: { docs: VaultDocCard[] }) {
  return (
    <Tile title="Recent in this set" className="sm:col-span-2 lg:col-span-2">
      {docs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No documents loaded.</p>
      ) : (
        <ul className="-mx-1 space-y-1">
          {docs.slice(0, 5).map((d) => (
            <li key={d.id}>
              <Link
                href={d.href}
                className="flex items-center gap-3 rounded-2xl px-2 py-2 transition-colors hover:bg-muted/50"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted font-mono text-[10px] uppercase">
                  {d.level.slice(0, 2)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{d.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {d.category || "uncategorised"} · {d.sizeLabel}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Tile>
  );
}

function ActivityTile({
  activity,
  accent,
  accent2,
}: {
  activity: VaultActivity[];
  accent: string;
  accent2: string;
}) {
  return (
    <Tile title="Activity" className="sm:col-span-2 lg:col-span-1">
      {activity.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No activity rows for this view.
        </p>
      ) : (
        <ul className="-mx-2">
          {activity.slice(0, 5).map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-3 rounded-2xl px-2 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium">{a.title}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {a.detail} · {a.time}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-[12px] tabular-nums">{a.amount}</p>
                <p
                  className="font-mono text-[10px] font-semibold"
                  style={{
                    color:
                      a.status === "denied"
                        ? accent2
                        : a.status === "allowed"
                          ? accent
                          : "var(--color-muted-foreground)",
                  }}
                >
                  {a.status}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Tile>
  );
}

/** Build cumulative daily history from document created_at (loaded rows only). */
export function historyFromDocuments(
  rows: { created_at: string }[],
  days = 30,
): number[] {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  const buckets = new Array(days).fill(0) as number[];
  for (const row of rows) {
    const d = new Date(row.created_at);
    d.setHours(0, 0, 0, 0);
    const idx = Math.round((d.getTime() - start.getTime()) / 86400000);
    if (idx >= 0 && idx < days) buckets[idx] += 1;
  }
  const cumulative: number[] = [];
  let sum = 0;
  for (const n of buckets) {
    sum += n;
    cumulative.push(sum);
  }
  return cumulative;
}

export function allocationFromDocuments(
  rows: { category: string }[],
): VaultAllocation[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = row.category?.trim() || "uncategorised";
    map.set(key, (map.get(key) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([symbol, value]) => ({ symbol, value }))
    .sort((a, b) => b.value - a.value);
}

export function Web3Bento({
  account,
  role,
  network = "TrustVault",
  documentCount,
  totalBytes,
  history = [],
  allocation = [],
  activity = [],
  recentDocs = [],
  levels = { owner: 0, edit: 0, read: 0 },
  caption,
  accent = "#ededed",
  accent2 = "#ef4444",
  className,
  footer,
}: Web3BentoProps) {
  const reduced = useReducedMotion();

  return (
    <div className={cn("w-full", className)}>
      <nav
        className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1"
        aria-label="Dashboard context"
      >
        <p className="text-sm text-muted-foreground">Overview</p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-[12px] font-medium">
            <span className="size-2 rounded-full bg-foreground" aria-hidden />
            {network}
          </span>
          <span className="rounded-full bg-foreground px-3 py-1.5 font-mono text-[12px] font-semibold text-background">
            {role}
          </span>
        </div>
      </nav>

      {/* 3-column grid so tiles fill the row (4-col left a dead gap). */}
      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <HeroTile
          account={account}
          role={role}
          documentCount={documentCount}
          totalBytes={totalBytes}
          history={history}
          accent={accent}
          reduced={reduced}
        />
        <LevelsTile levels={levels} accent={accent} />
        <ChartTile history={history} accent={accent} caption={caption} />
        <AllocationTile
          allocation={allocation}
          accent={accent}
          accent2={accent2}
        />
        <RecentDocsTile docs={recentDocs} />
        <ActivityTile
          activity={activity}
          accent={accent}
          accent2={accent2}
        />
      </div>
      {footer ? <div className="mt-3 w-full">{footer}</div> : null}
    </div>
  );
}

export default Web3Bento;

/** @deprecated Prefer Web3Bento with real props — no invented crypto DEMO. */
export const DEMO = null;
