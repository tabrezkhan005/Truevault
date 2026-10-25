"use client";

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

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { DocumentRow } from "@/lib/api";

const COLORS = ["#6366f1", "#818cf8", "#a5b4fc", "#c7d2fe", "#4f46e5", "#4338ca"];

export function CategoryChart({
  rows,
  mode = "bar",
  title = "By category",
  caption,
}: {
  rows: DocumentRow[];
  mode?: "bar" | "donut";
  title?: string;
  caption: string;
}) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = row.category?.trim() || "uncategorised";
    map.set(key, (map.get(key) || 0) + 1);
  }
  const data = Array.from(map.entries()).map(([name, value]) => ({ name, value }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{caption}</CardDescription>
      </CardHeader>
      <CardContent className="h-64">
        {data.length === 0 ? (
          <EmptyState title="No categories in this set" />
        ) : mode === "donut" ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "#111118",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 12,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <XAxis dataKey="name" tick={{ fill: "#9b9bab", fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fill: "#9b9bab", fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: "#111118",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 12,
                }}
              />
              <Bar dataKey="value" fill="#6366f1" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function UploadsOverTimeChart({
  rows,
  days,
  caption,
}: {
  rows: DocumentRow[];
  days: number;
  caption: string;
}) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));

  const buckets = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const row of rows) {
    const key = row.created_at.slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) || 0) + 1);
  }
  const data = Array.from(buckets.entries()).map(([day, value]) => ({
    day: day.slice(5),
    value,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Uploads over time</CardTitle>
        <CardDescription>{caption}</CardDescription>
      </CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis dataKey="day" tick={{ fill: "#9b9bab", fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis allowDecimals={false} tick={{ fill: "#9b9bab", fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                background: "#111118",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 12,
              }}
            />
            <Bar dataKey="value" fill="#6366f1" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function StorageByCategoryChart({
  rows,
  caption,
}: {
  rows: DocumentRow[];
  caption: string;
}) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = row.category?.trim() || "uncategorised";
    map.set(key, (map.get(key) || 0) + row.size_bytes);
  }
  const data = Array.from(map.entries()).map(([name, value]) => ({
    name,
    value: Math.round(value / 1024),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Storage by category</CardTitle>
        <CardDescription>{caption} (KB)</CardDescription>
      </CardHeader>
      <CardContent className="h-64">
        {data.length === 0 ? (
          <EmptyState title="No storage data in this set" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <XAxis dataKey="name" tick={{ fill: "#9b9bab", fontSize: 11 }} />
              <YAxis tick={{ fill: "#9b9bab", fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: "#111118",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 12,
                }}
              />
              <Bar dataKey="value" fill="#818cf8" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
