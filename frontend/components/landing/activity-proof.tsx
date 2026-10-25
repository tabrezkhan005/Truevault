"use client";

import { Ban, Download, KeyRound, ShieldCheck } from "lucide-react";

import {
  ProgressMetricCard,
  type MetricSeries,
  type SeriesPoint,
} from "@/components/ui/progress-metric-card";

/** Illustrative sample series for the public landing — not live API data. */
const accessAttempts: SeriesPoint[] = [
  { value: 42, date: "18 Mar" },
  { value: 51, date: "21 Mar" },
  { value: 48, date: "24 Mar" },
  { value: 63, date: "27 Mar" },
  { value: 71, date: "30 Mar" },
  { value: 66, date: "02 Apr" },
  { value: 88, date: "05 Apr" },
  { value: 79, date: "08 Apr" },
  { value: 84, date: "11 Apr" },
  { value: 92, date: "14 Apr" },
  { value: 86, date: "17 Apr" },
  { value: 97, date: "20 Apr" },
  { value: 91, date: "23 Apr" },
  { value: 104, date: "26 Apr" },
  { value: 98, date: "29 Apr" },
  { value: 112, date: "02 May" },
  { value: 108, date: "05 May" },
  { value: 119, date: "08 May" },
  { value: 126, date: "11 May" },
];

const grantVsRefuse: MetricSeries[] = [
  {
    name: "Granted",
    accent: "emerald",
    data: [
      { value: 34, date: "18 Mar" },
      { value: 41, date: "21 Mar" },
      { value: 38, date: "24 Mar" },
      { value: 49, date: "27 Mar" },
      { value: 55, date: "30 Mar" },
      { value: 52, date: "02 Apr" },
      { value: 68, date: "05 Apr" },
      { value: 61, date: "08 Apr" },
      { value: 64, date: "11 Apr" },
      { value: 72, date: "14 Apr" },
      { value: 67, date: "17 Apr" },
      { value: 74, date: "20 Apr" },
      { value: 70, date: "23 Apr" },
      { value: 81, date: "26 Apr" },
      { value: 76, date: "29 Apr" },
      { value: 88, date: "02 May" },
      { value: 84, date: "05 May" },
      { value: 91, date: "08 May" },
      { value: 96, date: "11 May" },
    ],
  },
  {
    name: "Refused",
    accent: "rose",
    data: [
      { value: 8, date: "18 Mar" },
      { value: 10, date: "21 Mar" },
      { value: 10, date: "24 Mar" },
      { value: 14, date: "27 Mar" },
      { value: 16, date: "30 Mar" },
      { value: 14, date: "02 Apr" },
      { value: 20, date: "05 Apr" },
      { value: 18, date: "08 Apr" },
      { value: 20, date: "11 Apr" },
      { value: 20, date: "14 Apr" },
      { value: 19, date: "17 Apr" },
      { value: 23, date: "20 Apr" },
      { value: 21, date: "23 Apr" },
      { value: 23, date: "26 Apr" },
      { value: 22, date: "29 Apr" },
      { value: 24, date: "02 May" },
      { value: 24, date: "05 May" },
      { value: 28, date: "08 May" },
      { value: 30, date: "11 May" },
    ],
  },
];

const highlights = [
  {
    icon: ShieldCheck,
    label: "Server-side check",
    detail: "Every list, download and edit runs authorize() before any bytes leave.",
  },
  {
    icon: Ban,
    label: "Refusals counted",
    detail: "Denied attempts are written to the same append-only chain as successes.",
  },
  {
    icon: KeyRound,
    label: "Revoke is immediate",
    detail: "No lingering tokens — the next request after revoke returns 404.",
  },
  {
    icon: Download,
    label: "Streamed downloads",
    detail: "Files leave only through Django after the grant check, never by URL.",
  },
] as const;

/**
 * Mid-page proof section: interactive metric cards + TrustVault guarantees
 * framed as an admin activity preview (illustrative series only).
 */
export function ActivityProofSection() {
  return (
    <section
      id="activity"
      aria-labelledby="activity-heading"
      className="scroll-mt-24 border-t border-white/10 px-4 pt-10 pb-16 sm:pt-12 sm:pb-20"
    >
      <div className="container mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-teal-300/90">
            Admin preview
          </p>
          <h2
            id="activity-heading"
            className="mt-3 text-3xl font-bold text-white md:text-4xl"
          >
            Activity you can prove
          </h2>
          <p className="mt-4 text-base leading-relaxed text-gray-300">
            When someone reaches a document — or is refused — it shows up here.
            Peak, low and trend are derived from the same series an admin would
            review.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <ProgressMetricCard
            title="Access attempts"
            unit="attempts"
            data={accessAttempts}
            accent="emerald"
            size="md"
            deltaLabel="vs prior day"
            defaultIndex={14}
            className="border-white/10"
          />

          <div className="flex flex-col gap-6">
            <ProgressMetricCard
              title="Granted vs refused"
              series={grantVsRefuse}
              size="sm"
              showStats={false}
              deltaLabel="net granted"
              period="Past 30 days"
              className="border-white/10"
            />

            <aside className="rounded-[28px] border border-white/10 bg-card px-6 py-5">
              <h3 className="text-sm font-semibold tracking-tight text-white">
                What the chart cannot hide
              </h3>
              <ul className="mt-4 space-y-4">
                {highlights.map(({ icon: Icon, label, detail }) => (
                  <li key={label} className="flex gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5 text-teal-300">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-sm font-medium text-white">{label}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        {detail}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Illustrative sample series for this landing — not live API data. The
          shape matches what an admin activity overview would show.
        </p>
      </div>
    </section>
  );
}
