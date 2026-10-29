"use client";

import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { shortDate } from "@/lib/dates";
import { formatHour } from "@/lib/prefs";
import { useTranslations } from "next-intl";

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
  const t = useTranslations("chart");
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 22, right: 12, bottom: 0, left: -18 }}>
        <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
        <XAxis dataKey="day" ticks={edgeTicks(data.map((d) => d.day))} tickFormatter={dayLabel} tick={AXIS} axisLine={{ stroke: "var(--chart-baseline)" }} tickLine={false} interval="preserveStartEnd" />
        <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={AXIS} axisLine={false} tickLine={false} width={40} />
        <Tooltip content={<TooltipBox unit={(v) => t("moodValue", { value: v })} />} cursor={{ stroke: "var(--chart-axis)", strokeDasharray: "2 3" }} />
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
          name={t("mood")}
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
  const t = useTranslations("chart");
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
        <Bar dataKey="value" name={t("count")} fill={color} radius={[2, 2, 0, 0]} maxBarSize={10} isAnimationActive={false} />
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

/** Dose times by day (DSH-07), drawn as plain SVG: x = day, y = hour of day. The card's label and table carry the data. */
export function DoseTimes({ points, days, height = 170 }: { points: { day: string; hour: number; name: string }[]; days: string[]; height?: number }) {
  const W = 340;
  const H = height;
  const pad = { l: 44, r: 8, t: 8, b: 22 };
  const index = new Map(days.map((d, i) => [d, i]));
  const x = (i: number) => pad.l + (days.length > 1 ? (i / (days.length - 1)) * (W - pad.l - pad.r) : (W - pad.l - pad.r) / 2);
  const y = (h: number) => pad.t + (h / 24) * (H - pad.t - pad.b);
  const ticks = [0, Math.floor((days.length - 1) / 2), days.length - 1].filter((v, i, a) => a.indexOf(v) === i);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} aria-hidden="true" preserveAspectRatio="none">
      {[6, 12, 18].map((h) => (
        <g key={h}>
          <line x1={pad.l} x2={W - pad.r} y1={y(h)} y2={y(h)} stroke="var(--chart-grid)" />
          <text x={pad.l - 6} y={y(h) + 4} textAnchor="end" fontSize={12} fontWeight={700} fill="var(--chart-axis)">{formatHour(h)}</text>
        </g>
      ))}
      <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="var(--chart-baseline)" />
      {ticks.map((i) => (
        <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === days.length - 1 ? "end" : "middle"} fontSize={12} fontWeight={700} fill="var(--chart-axis)">
          {days[i] ? dayLabel(days[i]) : ""}
        </text>
      ))}
      {points.map((p, i) => (
        <circle key={i} cx={x(index.get(p.day) ?? 0)} cy={y(p.hour)} r={4.5} fill="var(--chart-3)" stroke="var(--card)" strokeWidth={1.5}>
          <title>{`${p.name}, ${dayLabel(p.day)}, ${formatHour(p.hour)}`}</title>
        </circle>
      ))}
    </svg>
  );
}

// Sequential, one hue, three steps: lower mood is deeper. Each step keeps text at 4.5:1 or better in
// light and dark themes, and every cell prints its value, so color is never the only cue.
function heatStyle(avg: number | null): React.CSSProperties {
  if (avg === null) return { background: "var(--secondary)", color: "var(--muted-foreground)" };
  if (avg < 2.5) return { background: "var(--chart-mood)", color: "var(--primary-foreground)" };
  if (avg < 3.5) return { background: "color-mix(in oklab, var(--chart-mood) 30%, var(--card))", color: "var(--foreground)" };
  return { background: "color-mix(in oklab, var(--chart-mood) 10%, var(--card))", color: "var(--foreground)" };
}

/** DSH-05: average mood by time block (rows) and weekday (columns). */
export function MoodHeatmap({ rows }: { rows: { block: string; cells: { weekday: string; avg: number | null; n: number }[] }[] }) {
  const t = useTranslations("insights.trends");
  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed border-separate border-spacing-[3px] text-micro tabular-nums">
        <thead>
          <tr>
            <th scope="col" className="w-[58px]"><span className="sr-only">{t("timeOfDay")}</span></th>
            {rows[0]?.cells.map((c) => <th key={c.weekday} scope="col" className="font-extrabold text-muted-foreground">{c.weekday}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.block}>
              <th scope="row" className="w-[58px] text-left font-extrabold text-muted-foreground whitespace-nowrap">{r.block}</th>
              {r.cells.map((c) => (
                <td
                  key={c.weekday}
                  className="h-8 rounded-md text-center font-extrabold"
                  style={heatStyle(c.avg)}
                  aria-label={t("heatCell", { block: r.block, weekday: c.weekday, value: c.avg ?? t("noLogs") })}
                >
                  {c.avg ?? "·"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * DSH-09: one row per food, a 100% bar split into ate it (blue), in between (grid gray) and refused
 * (amber), with a 2px surface gap between segments. The counts are printed beside each name, so the
 * colors are never the only cue.
 */
export function FoodSplit({ rows, hidden = 0 }: { rows: { label: string; logs: number; accepted: number; refused: number }[]; hidden?: number }) {
  const t = useTranslations("insights.trends");
  const split = rows.length > 8 || hidden > 0 ? Math.ceil(rows.length / 2) : -1;
  return (
    <div className="space-y-2.5">
      <ul className="space-y-2.5">
        {rows.map((r, i) => {
          const neither = r.logs - r.accepted - r.refused;
          const seg = (n: number, color: string) => (n > 0 ? <span style={{ flexGrow: n, background: color }} className="h-full first:rounded-l-full last:rounded-r-full" /> : null);
          return (
            <li key={r.label} className={i === split ? "pt-2.5 border-t border-dashed border-divider" : undefined}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-label font-extrabold text-foreground truncate">{r.label}</span>
                <span className="flex-none text-micro font-bold text-foreground-2 tabular-nums">
                  {t("foodCounts", { accepted: r.accepted, refused: r.refused, logs: r.logs })}
                </span>
              </div>
              <div className="mt-1 h-2 flex gap-[2px]">
                {seg(r.accepted, "var(--chart-1)")}
                {seg(neither, "var(--chart-grid)")}
                {seg(r.refused, "var(--chart-highlight)")}
              </div>
            </li>
          );
        })}
      </ul>
      {hidden > 0 && <p className="text-micro font-bold text-muted-foreground">{t("foodsHidden", { count: hidden })}</p>}
      <p className="flex flex-wrap gap-x-3 gap-y-1 text-micro font-bold text-foreground-2">
        <span className="flex items-center gap-1"><span aria-hidden="true" className="w-2.5 h-2.5 rounded-full bg-[var(--chart-1)]" />{t("legendAte")}</span>
        <span className="flex items-center gap-1"><span aria-hidden="true" className="w-2.5 h-2.5 rounded-full bg-[var(--chart-grid)] border border-border" />{t("legendSome")}</span>
        <span className="flex items-center gap-1"><span aria-hidden="true" className="w-2.5 h-2.5 rounded-full bg-[var(--chart-highlight)]" />{t("legendRefused")}</span>
      </p>
    </div>
  );
}

/**
 * DSH-09 / EAT-09: new-food markers on the range's time axis, numbered, with a key underneath.
 * Plain SVG like DoseTimes; the card's table carries the same data.
 */
export function NewFoodStrip({ days, items }: { days: string[]; items: { day: string; label: string; note: string }[] }) {
  const W = 340;
  const pad = { l: 12, r: 12, t: 12, b: 22 };
  const index = new Map(days.map((d, i) => [d, i]));
  const x = (i: number) => pad.l + (days.length > 1 ? (i / (days.length - 1)) * (W - pad.l - pad.r) : (W - pad.l - pad.r) / 2);
  const ticks = [0, Math.floor((days.length - 1) / 2), days.length - 1].filter((v, i, a) => a.indexOf(v) === i);
  // Markers closer than a circle's width stack into lanes so their numbers stay readable.
  const LANE = 22;
  const laneEnds: number[] = [];
  const placed = items.map((it) => {
    const cx = x(index.get(it.day) ?? 0);
    let lane = laneEnds.findIndex((end) => cx - end >= 20);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = cx;
    return { cx, lane };
  });
  const H = 64 + Math.max(0, laneEnds.length - 1) * LANE;
  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} aria-hidden="true" preserveAspectRatio="none">
        <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="var(--chart-baseline)" />
        {ticks.map((i) => (
          <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === days.length - 1 ? "end" : "middle"} fontSize={12} fontWeight={700} fill="var(--chart-axis)">
            {days[i] ? dayLabel(days[i]) : ""}
          </text>
        ))}
        {items.map((it, n) => {
          const { cx, lane } = placed[n];
          const cy = pad.t + lane * LANE;
          return (
            <g key={`${it.day}-${n}`}>
              <line x1={cx} x2={cx} y1={cy + 9} y2={H - pad.b} stroke="var(--chart-5)" strokeWidth={1.5} strokeDasharray="4 3" />
              <circle cx={cx} cy={cy} r={9} fill="var(--chart-5)" stroke="var(--card)" strokeWidth={2} />
              <text x={cx} y={cy + 4} textAnchor="middle" fontSize={11} fontWeight={800} fill="var(--card)">{n + 1}</text>
            </g>
          );
        })}
      </svg>
      <ol className="space-y-1">
        {items.map((it, n) => (
          <li key={`${it.day}-${n}`} className="flex items-baseline gap-2 text-label">
            <span aria-hidden="true" className="w-5 h-5 flex-none rounded-full bg-[var(--chart-5)] text-card text-micro font-extrabold flex items-center justify-center">{n + 1}</span>
            <span className="font-extrabold text-foreground">{it.label}</span>
            <span className="text-foreground-2">{it.note}</span>
          </li>
        ))}
      </ol>
    </div>
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
