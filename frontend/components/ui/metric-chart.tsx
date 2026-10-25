"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const TOOLTIP_MAX_WIDTH = 180;

export interface SeriesPoint {
  value: number;
  date: string;
}

export interface MetricSeries {
  name: string;
  data: SeriesPoint[];
  accent?: MetricAccent;
}

/** Accents tuned for dark TrustVault surfaces. */
export type MetricAccent =
  | "blue"
  | "emerald"
  | "amber"
  | "rose"
  | "violet"
  | "neutral";
export type ChartView = "curve" | "bars";

export interface ChartSeries {
  name: string;
  data: SeriesPoint[];
  color: string;
}

export const SERIES_COLORS = [
  "#2dd4bf",
  "#38bdf8",
  "#fbbf24",
  "#a78bfa",
  "#fb7185",
  "#94a3b8",
];

export const ACCENTS: Record<
  MetricAccent,
  { stroke: string; text: string; fill: string; soft: string }
> = {
  blue: {
    stroke: "#38bdf8",
    text: "#7dd3fc",
    fill: "#0c4a6e",
    soft: "rgba(56,189,248,0.18)",
  },
  emerald: {
    stroke: "#2dd4bf",
    text: "#5eead4",
    fill: "#134e4a",
    soft: "rgba(45,212,191,0.18)",
  },
  amber: {
    stroke: "#fbbf24",
    text: "#fcd34d",
    fill: "#78350f",
    soft: "rgba(251,191,36,0.18)",
  },
  rose: {
    stroke: "#fb7185",
    text: "#fda4af",
    fill: "#881337",
    soft: "rgba(251,113,133,0.18)",
  },
  violet: {
    stroke: "#a78bfa",
    text: "#c4b5fd",
    fill: "#4c1d95",
    soft: "rgba(167,139,250,0.18)",
  },
  neutral: {
    stroke: "#94a3b8",
    text: "#cbd5e1",
    fill: "#1e293b",
    soft: "rgba(148,163,184,0.16)",
  },
};

export function formatCompact(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: value >= 100 ? 0 : 1,
  }).format(value);
}

interface MetricChartProps {
  series: ChartSeries[];
  view?: ChartView;
  defaultIndex?: number;
  valueFormatter?: (value: number) => string;
  dateFormatter?: (date: string) => string;
}

function seriesKey(name: string) {
  return name.replace(/\s+/g, "-").toLowerCase();
}

export function MetricChart({
  series,
  view = "curve",
  valueFormatter = (value) => value.toLocaleString(),
  dateFormatter = (date) => date,
}: MetricChartProps) {
  const primary = series[0];
  const gradientId = useId().replace(/:/g, "");
  const wrapRef = useRef<HTMLDivElement>(null);
  const [flipX, setFlipX] = useState(false);

  const chartData = useMemo(() => {
    if (!primary?.data.length) return [];
    return primary.data.map((point, index) => {
      const row: Record<string, string | number> = { date: point.date };
      for (const s of series) {
        row[s.name] = s.data[index]?.value ?? 0;
      }
      return row;
    });
  }, [primary, series]);

  useEffect(() => {
    function measure() {
      const rect = wrapRef.current?.getBoundingClientRect();
      if (!rect) return;
      setFlipX(window.innerWidth - rect.right < TOOLTIP_MAX_WIDTH + 16);
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  if (chartData.length < 2 || !primary) return null;

  const tooltipContentStyle = {
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(10,10,10,0.96)",
    boxShadow: "0 16px 40px rgba(0,0,0,0.45)",
    maxWidth: TOOLTIP_MAX_WIDTH,
    color: "#ededed",
    whiteSpace: "normal" as const,
  };

  return (
    <div ref={wrapRef} className="h-full w-full pointer-events-auto">
      <ResponsiveContainer width="100%" height="100%">
        {view === "bars" ? (
          <BarChart
            data={chartData}
            margin={{ top: 18, right: 6, bottom: 6, left: 0 }}
          >
            <XAxis dataKey="date" hide />
            <YAxis hide />
            <Tooltip
              cursor={{ fill: "rgba(148, 163, 184, 0.1)" }}
              allowEscapeViewBox={{ x: flipX, y: false }}
              reverseDirection={{ x: flipX, y: false }}
              wrapperStyle={{ zIndex: 30 }}
              contentStyle={tooltipContentStyle}
              formatter={(value, name) => [
                valueFormatter(Number(value)),
                String(name),
              ]}
              labelFormatter={(label) => dateFormatter(String(label))}
            />
            {series.map((s) => (
              <Bar
                key={s.name}
                dataKey={s.name}
                radius={[8, 8, 3, 3]}
                fill={s.color}
                fillOpacity={0.88}
              />
            ))}
          </BarChart>
        ) : (
          <AreaChart
            data={chartData}
            margin={{ top: 18, right: 6, bottom: 6, left: 0 }}
          >
            <defs>
              {series.map((s) => (
                <linearGradient
                  key={s.name}
                  id={`metric-fill-${gradientId}-${seriesKey(s.name)}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <XAxis dataKey="date" hide />
            <YAxis hide />
            <Tooltip
              cursor={{ stroke: primary.color, strokeDasharray: "4 4" }}
              allowEscapeViewBox={{ x: flipX, y: false }}
              reverseDirection={{ x: flipX, y: false }}
              wrapperStyle={{ zIndex: 30 }}
              contentStyle={tooltipContentStyle}
              formatter={(value, name) => [
                valueFormatter(Number(value)),
                String(name),
              ]}
              labelFormatter={(label) => dateFormatter(String(label))}
            />
            {series.map((s) => (
              <Area
                key={s.name}
                type="monotone"
                dataKey={s.name}
                stroke={s.color}
                strokeWidth={2.4}
                fill={`url(#metric-fill-${gradientId}-${seriesKey(s.name)})`}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
