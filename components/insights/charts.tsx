"use client";

import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer,
  Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from "recharts";
import { shortDate } from "@/lib/dates";
import { formatHour } from "@/lib/prefs";

// DESIGN 6: tokens only. CSS variables resolve per theme (light, dark, night).
const AXIS = { fontSize: 12, fill: "var(--chart-axis)", fontWeight: 700 } as const;

export interface Marker { day: string; label: string }
export interface Band { from: string; to: string; label: string }

const dayLabel = (day: string) => shortDate(new Date(`${day}T00:00:00`));

function edgeTicks(days: string[]) {
  if (days.length <= 3) return days;
  return [days[0], days[Math.floor(days.length / 2)], days[days.length - 1]];
}

function TooltipBox({ active, payload, label, unit }: { active?: boolean; payload?: { value: number | null; name: string }[]; label?: string; unit?: (v: number) => string }) {
  if (!active || !payload?.length || payload[0].value === null || payload[0].value === undefined) return null;
  return (
    <div className="rounded-lg bg-toast text-toast-foreground px-3 py-2 shadow-toast text-caption">
      <p className="font-extrabold">{label ? dayLabel(label) : ""}</p>
      {payload.map((p) => (
        <p key={p.name}>{unit ? unit(Number(p.value)) : p.value}</p>
      ))}
    </div>
  );
}

// Recharts only sees ReferenceLines that are direct children, so this returns elements rather than being a component.
function markerLines(markers: Marker[], days: string[]) {
  return markers.map((m) => (
        <ReferenceLine
          key={`${m.day}-${m.label}`}
          x={m.day}
          stroke="var(--chart-marker)"
          strokeWidth={1.5}
          strokeDasharray="5 4"
          label={{
            value: m.label,
            // Keep the label inside the plot: markers in the first half read rightward.
            position: days.indexOf(m.day) < days.length / 2 ? "insideTopLeft" : "insideTopRight",
            fill: "var(--chart-marker)",
            fontSize: 12,
            fontWeight: 800,
          }}
        />
  ));
}

/** Mood daily average, 1 to 5, with medication-change markers and optional before/after averages. */
export function MoodLine({
  data, markers = [], averages = [], height = 190,
}: {
  data: { day: string; avg: number | null }[];
  markers?: Marker[];
  averages?: { from: string; to: string; value: number; label: string }[];
  height?: number;
}) {
  const lastWithValue = [...data].reverse().find((d) => d.avg !== null);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 22, right: 12, bottom: 0, left: -18 }}>
        <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
        <XAxis dataKey="day" ticks={edgeTicks(data.map((d) => d.day))} tickFormatter={dayLabel} tick={AXIS} axisLine={{ stroke: "var(--chart-baseline)" }} tickLine={false} interval="preserveStartEnd" />
        <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={AXIS} axisLine={false} tickLine={false} width={40} />
        <Tooltip content={<TooltipBox unit={(v) => `Mood ${v}`} />} cursor={{ stroke: "var(--chart-axis)", strokeDasharray: "2 3" }} />
        {markerLines(markers, data.map((d) => d.day))}
        {averages.map((a) => (
          <ReferenceLine
            key={a.label}
            segment={[{ x: a.from, y: a.value }, { x: a.to, y: a.value }]}
            stroke="var(--foreground-2)"
            strokeDasharray="2 3"
            label={{ value: a.label, position: "insideBottomRight", offset: 6, fill: "var(--foreground-2)", fontSize: 12, fontWeight: 800 }}
          />
        ))}
        <Line
          type="monotone"
          dataKey="avg"
          name="Mood"
          stroke="var(--chart-mood)"
          strokeWidth={2.5}
          connectNulls
          isAnimationActive={false}
          dot={(props: { cx?: number; cy?: number; payload?: { day: string } }) =>
            props.payload?.day === lastWithValue?.day && props.cx !== undefined ? (
              <circle key="end" cx={props.cx} cy={props.cy} r={4.5} fill="var(--chart-mood)" stroke="var(--card)" strokeWidth={2} />
            ) : (
              <g key={props.payload?.day} />
            )
          }
          activeDot={{ r: 5, fill: "var(--chart-mood)", stroke: "var(--card)", strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Counts per day as thin bars (BMs, feeds, behaviors), with optional bands and a rolling average. */
export function DailyBars({
  data, color = "var(--chart-1)", markers = [], bands = [], average, unit, height = 170,
}: {
  data: { day: string; value: number; avg?: number | null }[];
  color?: string;
  markers?: Marker[];
  bands?: Band[];
  average?: boolean;
  unit?: (v: number) => string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 22, right: 12, bottom: 0, left: -18 }} barCategoryGap={2}>
        <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
        <XAxis dataKey="day" ticks={edgeTicks(data.map((d) => d.day))} tickFormatter={dayLabel} tick={AXIS} axisLine={{ stroke: "var(--chart-baseline)" }} tickLine={false} />
        <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} width={40} />
        <Tooltip content={<TooltipBox unit={unit} />} cursor={{ fill: "var(--chart-grid)" }} />
        {bands.map((b) => (
          <ReferenceArea key={b.from} x1={b.from} x2={b.to} fill="var(--chart-band)" fillOpacity={1}
            label={{ value: b.label, position: "insideTop", fill: "var(--chart-band-ink)", fontSize: 12, fontWeight: 800 }} />
        ))}
        {markerLines(markers, data.map((d) => d.day))}
        <Bar dataKey="value" name="Count" fill={color} radius={[2, 2, 0, 0]} maxBarSize={10} isAnimationActive={false} />
        {average && <Line type="monotone" dataKey="avg" stroke="var(--foreground-2)" strokeDasharray="2 3" dot={false} isAnimationActive={false} />}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Labeled comparison bars: neutral bars, one highlighted (PAT-01, PAT-02, PAT-03, portions). */
export function LabeledBars({
  data, highlight, domain, height = 170, format = (v) => String(v),
}: {
  data: { label: string; value: number | null }[];
  highlight?: string;
  domain?: [number, number];
  height?: number;
  format?: (v: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 22, right: 4, bottom: 0, left: 4 }} barCategoryGap="22%">
        <XAxis dataKey="label" tick={AXIS} axisLine={{ stroke: "var(--chart-baseline)" }} tickLine={false} interval={0} />
        <YAxis hide domain={domain ?? [0, "auto"]} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.label} fill={d.label === highlight ? "var(--chart-highlight)" : "var(--chart-neutral)"} />
          ))}
          <LabelList
            dataKey="value"
            position="top"
            formatter={(v: number) => (v === null || v === undefined ? "" : format(v))}
            style={{ fontSize: 13, fontWeight: 800, fill: "var(--foreground-2)" }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Horizontal bars for "top" lists (activities, feelings). */
export function TopBars({ data, color = "var(--chart-4)", height }: { data: { label: string; value: number; note?: string }[]; color?: string; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height ?? Math.max(60, data.length * 32 + 8)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 0 }} barCategoryGap={8}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="label" tick={{ ...AXIS, fill: "var(--foreground)" }} axisLine={false} tickLine={false} width={120} />
        <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} maxBarSize={18} isAnimationActive={false}>
          <LabelList dataKey="value" position="right" style={{ fontSize: 12, fontWeight: 800, fill: "var(--foreground-2)" }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Dose times by day (DSH-07). y = hour of day. */
export function DoseTimes({ points, days, height = 170 }: { points: { day: string; hour: number; name: string }[]; days: string[]; height?: number }) {
  const index = new Map(days.map((d, i) => [d, i]));
  const data = points.map((p) => ({ x: index.get(p.day) ?? 0, y: Math.round(p.hour * 10) / 10, name: p.name, day: p.day }));
  const hourLabel = formatHour;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 8, right: 12, bottom: 0, left: -10 }}>
        <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
        <XAxis type="number" dataKey="x" domain={[0, Math.max(0, days.length - 1)]} ticks={[0, Math.floor((days.length - 1) / 2), days.length - 1]} tickFormatter={(i: number) => (days[i] ? dayLabel(days[i]) : "")} tick={AXIS} axisLine={{ stroke: "var(--chart-baseline)" }} tickLine={false} />
        <YAxis type="number" dataKey="y" domain={[0, 24]} ticks={[6, 12, 18]} tickFormatter={hourLabel} reversed tick={AXIS} axisLine={false} tickLine={false} width={48} />
        <Tooltip
          cursor={false}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <div className="rounded-lg bg-toast text-toast-foreground px-3 py-2 shadow-toast text-caption">
                <p className="font-extrabold">{String(payload[0].payload.name)}</p>
                <p>{dayLabel(String(payload[0].payload.day))}, {hourLabel(Number(payload[0].payload.y))}</p>
              </div>
            ) : null
          }
        />
        <Scatter data={data} fill="var(--chart-3)" isAnimationActive={false} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

/** Tiny mood line for the Today card. */
export function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 96;
  const h = 28;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - 1) / 4) * h}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`-2 -2 ${w + 4} ${h + 4}`} aria-hidden="true" className="text-mood-ink">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
